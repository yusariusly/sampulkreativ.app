/**
 * @module ScoreboardController
 * @description Controller handling scoreboard retrieval and management.
 */

const scoreboardService = require('../services/scoreboard.service');
const studentRepo = require('../repositories/student.repository');

/**
 * Mengambil data scoreboard grup PKL siswa untuk minggu tertentu
 * GET /api/v1/pkl/scoreboard
 */
async function getScoreboard(req, res, next) {
  try {
    const dbClient = req.app.pool;
    const user = req.user;
    
    let weekNumber = req.query.week ? parseInt(req.query.week, 10) : null;
    
    // Jika weekNumber tidak ditentukan, cari default minggu berjalan berdasarkan baseline cohort
    if (!weekNumber) {
      const [minStartRes] = await dbClient.query(
        "SELECT MIN(start_date) as min_start FROM pkl_students WHERE status = 'ACTIVE'"
      );
      const baselineStart = minStartRes[0]?.min_start || new Date("2026-06-29");
      const diffTime = Math.abs(new Date() - new Date(baselineStart));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      weekNumber = Math.max(1, Math.ceil(diffDays / 7));
    }

    const data = await scoreboardService.getScoreboard(dbClient, user, weekNumber);

    res.status(200).json({
      status: 'success',
      data
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Men-toggle status visibilitas global scoreboard (Hanya Admin)
 * POST /api/v1/pkl/scoreboard/toggle
 */
async function toggleScoreboardVisibility(req, res, next) {
  try {
    const dbClient = req.app.pool;
    const { show_scoreboard } = req.body;

    if (show_scoreboard === undefined) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'INVALID_INPUT',
          message: 'Status show_scoreboard wajib ditentukan (true/false)'
        }
      });
    }

    await scoreboardService.toggleScoreboardVisibility(dbClient, show_scoreboard);

    res.status(200).json({
      status: 'success',
      message: `Visibilitas scoreboard berhasil diubah menjadi ${show_scoreboard ? 'tampil' : 'sembunyi'}`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mengambil riwayat pemeringkatan mingguan individu siswa
 * GET /api/v1/pkl/scoreboard/history
 */
async function getScoreboardHistory(req, res, next) {
  try {
    const dbClient = req.app.pool;
    const user = req.user;

    let targetStudentId = null;
    if (user.role === 'student') {
      const student = await studentRepo.findByUserId(dbClient, user.id);
      if (!student) {
        return res.status(404).json({
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Profil siswa tidak ditemukan'
          }
        });
      }
      targetStudentId = student.student_id;
    } else {
      // Admin bisa mempassing student_id lewat query
      targetStudentId = req.query.student_id;
      if (!targetStudentId) {
        return res.status(400).json({
          status: 'error',
          error: {
            code: 'INVALID_INPUT',
            message: 'student_id wajib disertakan untuk admin'
          }
        });
      }
    }

    const history = await scoreboardService.getStudentScoreboardHistory(dbClient, targetStudentId);

    res.status(200).json({
      status: 'success',
      data: history
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getScoreboard,
  toggleScoreboardVisibility,
  getScoreboardHistory
};
