const express = require('express');
const router = express.Router();

const studentRoutes = require('./student.routes');
const mentorRoutes = require('./mentor.routes');
const scoreboardRoutes = require('./scoreboard.routes');

// Mount sub-router
router.use('/siswa', studentRoutes);
router.use('/mentor', mentorRoutes);
router.use('/pkl/scoreboard', scoreboardRoutes);

module.exports = router;
