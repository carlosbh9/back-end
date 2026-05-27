const { Router } = require('express');
const financialReportService = require('../../Services/reports/financial-report.service');

const router = Router();

router.get('/financial', async (req, res) => {
  try {
    const { year, month, travelDesignerId, destination, page, pageSize } = req.query;
    const result = await financialReportService.getReport({
      year,
      month,
      travelDesignerId,
      destination,
      page,
      pageSize,
    });
    return res.json(result);
  } catch (error) {
    console.error('[FinancialReport]', error);
    return res.status(500).json({ error: 'Could not generate financial report' });
  }
});

module.exports = router;
