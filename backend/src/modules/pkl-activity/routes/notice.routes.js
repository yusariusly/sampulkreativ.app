const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/notice.controller');
const { validateDeviceSession, requireRole } = require('./middlewares');

// Seluruh rute manajemen notice wajib melalui verifikasi session dan berstatus mentor/admin
router.use(validateDeviceSession);
router.use(requireRole(['admin', 'mentor']));

// GET /api/v1/pkl/notices - Mendapatkan daftar seluruh notice
router.get('/', noticeController.adminGetNotices);

// POST /api/v1/pkl/notices - Membuat atau memperbarui notice
router.post('/', noticeController.adminSaveNotice);

// DELETE /api/v1/pkl/notices/:id - Menghapus notice
router.delete('/:id', noticeController.adminDeleteNotice);

module.exports = router;
