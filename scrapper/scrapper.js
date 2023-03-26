const puppeteer = require('puppeteer');
const fs = require('fs');

const path = require('path');

let jsonPath = path.join(__dirname, './scrapped_offers.json');

const options = {
    headless: true,
    argheadless: true,
    ignoreHTTPSErrors: true,
    args: [
        `--proxy-server=${process.env.PROXY_IP}:${process.env.PROXY_PORT}`,
        `--ignore-certificate-errors`,
        `--no-sandbox`,
        `--disable-setuid-sandbox`
    ]
};
const credentials = {
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
};

// Scrape Data
function scrapeData(pagesToScrape) {
    console.log("Start Scraping .....")
    return new Promise(async (resolve, reject) => {
        try {

            if (!pagesToScrape) {
                pagesToScrape = 1;
            }

            const browser = await puppeteer.launch(options);
            const page = await browser.newPage();
            await page.authenticate(credentials);
            await page.setRequestInterception(true);
            const rejectRequestPattern = [
                "googlesyndication.com",
                "/*.doubleclick.net",
                "/*.amazon-adsystem.com",
                "/*.adnxs.com",
            ];
            page.on('request', (request) => {
                if (request.resourceType() === 'fetch'
                    || request.resourceType() === 'image'
                    || request.resourceType() === 'media'
                    || request.resourceType() === 'font'
                    || request.resourceType() === 'stylesheet'
                    || rejectRequestPattern.find((pattern) => request.url().match(pattern))
                ) {
                    request.abort()
                } else {
                    request.continue()
                }
            });
            await page.goto("https://focusgroups.org/all/", {
                waitUntil: 'domcontentloaded',
                // Remove the timeout
                timeout: 60000
            });


            let currentPage = 1;
            let temp_offres = [];

            while (currentPage <= pagesToScrape) {
                await page.waitForSelector(".job-wrapper .job__item-content", {
                    timeout: 60000
                });
                let newTemp_offres = await page.evaluate(() => {
                    let results = [];
                    let container = document.querySelector('.job-wrapper');
                    let items = container.querySelectorAll('.job__item-content');
                    items.forEach((item) => {
                        results.push({
                            url: 'https://focusgroups.org' + item.querySelector(".job__item-content-title").getAttribute('href'),
                            title: item.querySelector(".job__item-content-title")?.textContent,
                            age: item.querySelector(".job__item-content-age_value")?.textContent,
                            gender: item.querySelector(".job__item-content-gender_value")?.textContent,
                            published: item.querySelector(".job__item-content-published_value")?.textContent,
                            expires: item.querySelector(".job__item-content-expires_value")?.textContent,
                            payout: item.nextSibling.querySelector(".job__item-action-payout")?.textContent?.slice(6),
                            facility: item.querySelector(".job__item-content-facility_value")?.textContent.includes("Local R") ? "In person" : "Online",

                        });
                    });
                    return results;
                })
                temp_offres = temp_offres.concat(newTemp_offres);
                if (currentPage < pagesToScrape) {
                    await Promise.all([
                        await page.waitForSelector('button span.mat-button-wrapper'),
                        await page.click('button span.mat-button-wrapper'),
                        await page.waitForSelector(".job-wrapper .job__item-content", {
                            timeout: 60000
                        })
                    ])
                }
                currentPage++;
            }

            let offres = []

            for (let temp_offre of temp_offres) {
                try {
                    let description = await scrapeDescription(temp_offre.url);
                    offres.push({ ...temp_offre, description: description })
                } catch (error) {
                    console.log("⛔ Scraping description faild")
                    console.log(error)
                }
            }

            console.log("End Scraping .....")
            browser.close();
            return resolve(offres);
        } catch (e) {
            return reject(e);
        }
    })
}


// Scrape description
function scrapeDescription(sub_url) {
    console.log("Start Scrapping Description .....")
    return new Promise(async (resolve, reject) => {
        try {
            const browser = await puppeteer.launch(options);
            const page = await browser.newPage();
            await page.authenticate(credentials);
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (request.resourceType() !== "document") {
                    request.abort()
                } else {
                    request.continue()
                }
            });
            await page.goto(`${sub_url}`);
            await page.waitForSelector(".details-description", {
                timeout: 0
            })

            let description = await page.evaluate(() => {
                return document.querySelector(".details-description p")?.textContent;
            })

            browser.close();
            return resolve(description);
        } catch (e) {
            return reject(e);
        }
    })
}

// Cache Data
async function saveDataToJson() {
    scrapeData(1)
        .then((offres) => {
            console.log(offres)
            const jsonData = JSON.stringify(offres)
            fs.writeFileSync(jsonPath, jsonData)
        })
        .catch((error) => {
            console.log("⛔ Scraping offers faild");
            console.log(error);
            console.log("🔄 Restarting operation");
            saveDataToJson();
        })
}

// Load cached Data
async function getScrappedData() {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
    return data;
}

module.exports = { saveDataToJson, getScrappedData }
