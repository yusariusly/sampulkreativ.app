const express = require('express');
const router = express.Router();
const scoreboardController = require('../controllers/scoreboard.controller');
const { validateDeviceSession, requireRole } = require('./middlewares');

// Rute scoreboard wajib melalui verifikasi session
router.use(validateDeviceSession);

// GET /api/v1/pkl/scoreboard - Akses oleh student dan admin/mentor
router.get('/', requireRole(['student', 'admin', 'mentor']), scoreboardController.getScoreboard);

// GET /api/v1/pkl/scoreboard/history - Akses oleh student dan admin/mentor
router.get('/history', requireRole(['student', 'admin', 'mentor']), scoreboardController.getScoreboardHistory);

// POST /api/v1/pkl/scoreboard/toggle - Hanya akses oleh admin/mentor
router.post('/toggle', requireRole(['admin', 'mentor']), scoreboardController.toggleScoreboardVisibility);

module.exports = router;
