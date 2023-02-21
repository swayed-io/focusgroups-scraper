require('dotenv').config()
const express = require('express');
const cron = require('cron');
const cors = require('cors');

const { getScrappedData, saveDataToJson } = require("./scrapper/scrapper");

const app = express();

app.use(cors("http://localhost:3000"));


const job = new cron.CronJob('1 * * * *', async function () {
    console.log("Start Cron Job Every Hour ....")
    await saveDataToJson();
}, null, true, 'America/Los_Angeles');


app.get('/scrape-offers', (req, res) => {
    getScrappedData()
        .then((data) => {
            res.status(200).json(data);
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json('Error scraping offers');
        });
});

app.listen(8080, async () => {
    console.log('Server listening on port 8080');
    await saveDataToJson();
    job.start();
});
