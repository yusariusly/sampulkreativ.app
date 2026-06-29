const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentor.controller');
const validator = require('../validators/mentor.validator');
const { validateDeviceSession, requireRole, verifyStudentOwnership } = require('./middlewares');

// Semua rute mentor wajib melalui verifikasi session & pembatasan peran 'mentor' / 'admin'
router.use(validateDeviceSession);
router.use(requireRole(['mentor', 'admin']));

// GET /api/v1/mentor/siswa
router.get('/siswa', validator.validateGetSiswaBimbingan, mentorController.getSiswaBimbingan);

// PUT /api/v1/mentor/evaluasi-harian
router.put('/evaluasi-harian', validator.validateDailyEvaluation, verifyStudentOwnership, mentorController.saveDailyEvaluation);

// POST /api/v1/mentor/evaluasi-harian/kirim
router.post('/evaluasi-harian/kirim', validator.validateSubmitSession, mentorController.submitDailySession);

// GET /api/v1/mentor/rekap-mingguan
router.get('/rekap-mingguan', validator.validateGetWeeklyRekap, mentorController.getWeeklyRekapList);

// PUT /api/v1/mentor/rekap-mingguan/:studentId
router.put('/rekap-mingguan/:studentId', validator.validateWeeklyFeedback, verifyStudentOwnership, mentorController.saveWeeklyFeedback);

// POST /api/v1/mentor/rekap-mingguan/publikasikan
router.post('/rekap-mingguan/publikasikan', validator.validatePublishSummary, mentorController.publishWeeklySummary);

// POST /api/v1/mentor/rekap-mingguan/sembunyikan
router.post('/rekap-mingguan/sembunyikan', validator.validatePublishSummary, mentorController.unpublishWeeklySummary);

module.exports = router;
