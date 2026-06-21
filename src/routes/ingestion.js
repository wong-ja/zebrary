const { Router } = require('express');
const { runIngestion } = require('../ingestion/runner');

const router = Router();

let lastRun = null;

router.post('/api/ingest/run', async (req, res) => {
  try {
    const result = await runIngestion();
    lastRun = { ...result, timestamp: new Date().toISOString() };
    res.json({
      success: true,
      message: `Ingestion complete: ${result.new} new, ${result.updated} updated, ${result.errors} errors`,
    });
  } catch (err) {
    console.error('Ingestion failed:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/api/ingest/status', (req, res) => {
  if (lastRun) {
    res.json({ success: true, lastRun });
  } else {
    res.json({ success: true, message: 'No ingestion run has been performed yet' });
  }
});

module.exports = router;
