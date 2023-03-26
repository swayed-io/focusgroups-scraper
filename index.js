require('dotenv').config()
const express = require('express');
const cron = require('cron');
const cors = require('cors');

const { getScrappedData, saveDataToJson } = require("./scrapper/scrapper");

const app = express();

app.use(cors())


const job = new cron.CronJob('1 * * * *', async function () {
    console.log("Start Cron Job Every Hour ....")
    await saveDataToJson();
}, null, true, 'America/Los_Angeles');

app.get('/', (req, res)=> {
    res.send('Scrapper is running....')
} )


app.get('/scrape-offers', async (req, res) => {    
    try {
       await getScrappedData()
        .then((data) => {
            res.status(200).json(data);
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json('Error scraping offers');
        });        
    } catch (error) {
      console.log(error)  
    }
});

app.listen(8080 || process.env.PORT, async () => {
    console.log('Server listening on port 8080');
    await saveDataToJson();
    job.start();
});
