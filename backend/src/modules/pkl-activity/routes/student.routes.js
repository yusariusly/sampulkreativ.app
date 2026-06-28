const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const validator = require('../validators/student.validator');
const { validateDeviceSession, requireRole } = require('./middlewares');

// Semua rute siswa wajib melalui verifikasi session & pembatasan peran 'student'
router.use(validateDeviceSession);
router.use(requireRole(['student']));

// GET /api/v1/siswa/aktivitas
router.get('/aktivitas', studentController.getAktivitasSiswa);

// GET /api/v1/siswa/riwayat
router.get('/riwayat', studentController.getRiwayatSiswa);

// PATCH /api/v1/siswa/tugas/:taskId
router.patch('/tugas/:taskId', validator.validateToggleTask, studentController.toggleTaskSiswa);

module.exports = router;
