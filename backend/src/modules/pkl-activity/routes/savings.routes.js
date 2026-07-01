const express = require('express');
const router = express.Router();
const savingsController = require('../controllers/savings.controller');
const { validateDeviceSession, requireRole } = require('./middlewares');

// Seluruh rute manajemen tabungan wajib melalui verifikasi session dan berstatus admin/mentor
router.use(validateDeviceSession);
router.use(requireRole(['admin', 'mentor']));

// GET /api/v1/pkl/savings - Mendapatkan daftar tabungan seluruh siswa
router.get('/', savingsController.adminGetSavings);

// PUT /api/v1/pkl/savings/:studentId - Memperbarui nominal tabungan siswa
router.put('/:studentId', savingsController.adminUpdateSavings);

module.exports = router;
