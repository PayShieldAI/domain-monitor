const express = require('express');
const apiLogController = require('../controllers/apiLogController');
const { authenticateFlexible, requireSuperadminOrApiKey } = require('../middlewares/auth');

const router = express.Router();

// All routes require superadmin or API key authentication
router.use(authenticateFlexible, requireSuperadminOrApiKey);

// Get recent API logs
router.get('/', apiLogController.getRecentLogs);

// Get API log by ID
router.get('/:id', apiLogController.getLogById);

// Get API logs by user ID
router.get('/user/:userId', apiLogController.getLogsByUserId);

// Get error logs (4xx and 5xx responses)
router.get('/errors/all', apiLogController.getErrorLogs);

// Get API statistics
router.get('/stats/summary', apiLogController.getStats);

// Delete old logs (cleanup)
router.delete('/cleanup', apiLogController.deleteOldLogs);

module.exports = router;
