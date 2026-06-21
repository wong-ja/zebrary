const cron = require('node-cron');
const { runIngestion } = require('./runner');

function startCron() {
  console.log('Cron scheduler started — ingestion will run every 24 hours');

  cron.schedule('0 0 * * *', async () => {
    console.log('Cron: starting scheduled ingestion...');
    try {
      await runIngestion();
      console.log('Cron: scheduled ingestion completed');
    } catch (err) {
      console.error('Cron: scheduled ingestion failed:', err.message);
    }
  });
}

module.exports = { startCron };
