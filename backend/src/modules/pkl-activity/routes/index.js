const express = require('express');
const router = express.Router();

const studentRoutes = require('./student.routes');
const mentorRoutes = require('./mentor.routes');

// Mount sub-router
router.use('/siswa', studentRoutes);
router.use('/mentor', mentorRoutes);

module.exports = router;
