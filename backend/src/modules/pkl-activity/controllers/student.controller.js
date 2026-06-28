/**
 * @module StudentController
 * @description Controller handling incoming HTTP requests for the PKL Student domain.
 */

const studentService = require('../services/student.service');
const taskService = require('../services/task.service');
const studentRepo = require('../repositories/student.repository');
const weeklySumRepo = require('../repositories/weekly-summary.repository');

/**
 * Mengambil data dashboard aktif siswa (hari ini, progres, program kerja, papan apresiasi)
 * GET /api/v1/siswa/aktivitas
 */
async function getAktivitasSiswa(req, res, next) {
  try {
    const userId = req.user.id;
    // Default menggunakan tanggal hari ini (GMT+7)
    const todayStr = req.query.date || new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const dbClient = req.app.pool;
    const dashboardData = await studentService.getStudentDashboard(dbClient, userId, todayStr);
    
    res.status(200).json({
      status: 'success',
      data: dashboardData
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mengambil riwayat poin mingguan lama siswa yang telah dipublikasikan
 * GET /api/v1/siswa/riwayat
 */
async function getRiwayatSiswa(req, res, next) {
  try {
    const userId = req.user.id;
    const dbClient = req.app.pool;

    // Cari profil siswa untuk mendapatkan student_id
    const student = await studentRepo.findByUserId(dbClient, userId);
    if (!student) {
      const err = new Error('Siswa tidak terdaftar');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const summaries = await weeklySumRepo.findPublishedByStudent(dbClient, student.student_id);
    
    const formattedHistory = summaries.map(sum => {
      let parsedTags = [];
      if (sum.tags) {
        try {
          parsedTags = typeof sum.tags === 'string' ? JSON.parse(sum.tags) : sum.tags;
        } catch (e) {
          parsedTags = sum.tags.split(',').filter(Boolean);
        }
      }
      return {
        week_number: sum.week_number,
        total_points: sum.total_points,
        tags: parsedTags,
        comments: sum.comments || ''
      };
    });

    res.status(200).json({
      status: 'success',
      data: formattedHistory
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mengubah status checklist tugas program kerja mandiri
 * PATCH /api/v1/siswa/tugas/:taskId
 */
async function toggleTaskSiswa(req, res, next) {
  try {
    const userId = req.user.id;
    const params = req.params;
    const body = req.body;

    const dbClient = req.app.pool;
    const success = await taskService.toggleStudentTask(dbClient, userId, params.taskId, body.is_completed);

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
  getAktivitasSiswa,
  getRiwayatSiswa,
  toggleTaskSiswa
};
