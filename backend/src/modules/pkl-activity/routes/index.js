const express = require('express');
const router = express.Router();

const studentRoutes = require('./student.routes');
const mentorRoutes = require('./mentor.routes');
const scoreboardRoutes = require('./scoreboard.routes');
const noticeRoutes = require('./notice.routes');
const savingsRoutes = require('./savings.routes');

// Mount sub-router
router.use('/siswa', studentRoutes);
router.use('/mentor', mentorRoutes);
router.use('/pkl/scoreboard', scoreboardRoutes);
router.use('/pkl/notices', noticeRoutes);
router.use('/pkl/savings', savingsRoutes);

module.exports = router;
