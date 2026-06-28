/**
 * @module MentorController
 * @description Controller handling incoming HTTP requests for the PKL Mentor domain.
 */

const studentService = require('../services/student.service');
const dailyEvaluationService = require('../services/daily-evaluation.service');
const mentorSessionService = require('../services/mentor-session.service');
const weeklySummaryService = require('../services/weekly-summary.service');

/**
 * Mengambil daftar siswa bimbingan mentor beserta evaluasi poin hariannya pada tanggal tertentu
 * GET /api/v1/mentor/siswa
 */
async function getSiswaBimbingan(req, res, next) {
  try {
    const mentorId = req.user.id;
    // Default menggunakan tanggal hari ini (GMT+7)
    const dateStr = req.query.date || new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

    const dbClient = req.app.pool;
    const students = await studentService.getMentorStudents(dbClient, mentorId, dateStr);

    res.status(200).json({
      status: 'success',
      data: students
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Auto-save poin harian siswa oleh mentor (Idempotent)
 * PUT /api/v1/mentor/evaluasi-harian
 */
async function saveDailyEvaluation(req, res, next) {
  try {
    const mentorId = req.user.id;
    const body = req.body;

    const dbClient = req.app.pool;
    const success = await dailyEvaluationService.saveDailyEvaluation(dbClient, mentorId, body);

    res.status(200).json({
      status: 'success',
      data: {
        success
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mengunci dan mengirim seluruh sesi evaluasi harian mentor pada tanggal tertentu
 * POST /api/v1/mentor/evaluasi-harian/kirim
 */
async function submitDailySession(req, res, next) {
  try {
    const mentorId = req.user.id;
    const body = req.body;

    const dbClient = req.app.pool;
    const success = await mentorSessionService.submitDailySession(dbClient, mentorId, body.session_date);

    res.status(200).json({
      status: 'success',
      data: {
        success
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mengambil rekapitulasi poin mingguan aktif seluruh siswa bimbingan mentor
 * GET /api/v1/mentor/rekap-mingguan
 */
async function getWeeklyRekapList(req, res, next) {
  try {
    const mentorId = req.user.id;
    const weekNumber = parseInt(req.query.week_number, 10);

    const dbClient = req.app.pool;
    const rekapList = await weeklySummaryService.getWeeklyRekapList(dbClient, mentorId, weekNumber);

    res.status(200).json({
      status: 'success',
      data: rekapList
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Menyimpan draf feedback mingguan (tags & comments) untuk siswa tertentu
 * PUT /api/v1/mentor/rekap-mingguan/:studentId
 */
async function saveWeeklyFeedback(req, res, next) {
  try {
    const mentorId = req.user.id;
    const params = req.params;
    const body = req.body;

    const dbClient = req.app.pool;
    const result = await weeklySummaryService.saveWeeklyFeedback(dbClient, mentorId, params.studentId, {
      week_number: body.week_number,
      tags: body.tags,
      comments: body.comments
    });

    res.status(200).json({
      status: 'success',
      data: {
        success: result.success,
        warning: result.warning
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mempublikasikan rekap mingguan untuk semua siswa bimbingan mentor pada minggu terkait
 * POST /api/v1/mentor/rekap-mingguan/publikasikan
 */
async function publishWeeklySummary(req, res, next) {
  try {
    const mentorId = req.user.id;
    const body = req.body;

    const dbClient = req.app.pool;
    const success = await weeklySummaryService.publishWeeklySummary(dbClient, mentorId, body.week_number);

    res.status(200).json({
      status: 'success',
      data: {
        success
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSiswaBimbingan,
  saveDailyEvaluation,
  submitDailySession,
  getWeeklyRekapList,
  saveWeeklyFeedback,
  publishWeeklySummary
};
