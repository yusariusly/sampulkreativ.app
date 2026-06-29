/**
 * @module DailyEvaluationService
 * @description Business logic for PKL daily evaluations, workday checks, and lock status validations.
 */

const studentRepo = require('../repositories/student.repository');
const dailyEvalRepo = require('../repositories/daily-evaluation.repository');
const mentorSessionRepo = require('../repositories/mentor-session.repository');
const studentService = require('./student.service');

/**
 * Memvalidasi apakah tanggal tertentu merupakan hari kerja (Senin s.d Jumat)
 * @param {string} dateStr - Tanggal pengujian (YYYY-MM-DD)
 * @returns {boolean} True jika hari kerja
 */
function isWorkday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Menyimpan/memperbarui poin harian siswa oleh mentor (dengan serangkaian validasi bisnis)
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor yang sedang login
 * @param {object} evalData - Payload data evaluasi
 * @param {string} evalData.student_id - ID Siswa PKL
 * @param {string} evalData.evaluation_date - Tanggal evaluasi (YYYY-MM-DD)
 * @param {number} evalData.wkt_point - Aspek Waktu (0/1)
 * @param {number} evalData.skp_point - Aspek Sikap (0/1)
 * @param {number} evalData.has_point - Aspek Hasil (0/1)
 * @param {number} evalData.ker_point - Aspek Sosial (0/1)
 * @param {number} evalData.ini_point - Aspek Inisiatif (0/1)
 * @throws {Error} Jika kepemilikan salah, tanggal di masa depan/bukan hari kerja, atau sesi terkunci
 * @returns {Promise<boolean>} True jika penyimpanan sukses
 */
async function saveDailyEvaluation(dbClient, mentorId, evalData) {
  // 1. Cek kepemilikan siswa (ownership check)
  await studentService.validateMentorStudentOwnership(dbClient, evalData.student_id, mentorId);

  // 2. Validasi Tanggal (tidak boleh masa depan)
  const todayStr = new Date().toISOString().split('T')[0];
  if (new Date(evalData.evaluation_date) > new Date(todayStr)) {
    const err = new Error('Tanggal evaluasi tidak boleh di masa depan');
    err.code = 'INVALID_INPUT';
    throw err;
  }

  // 3. Validasi Hari Kerja (Senin–Jumat)
  if (!isWorkday(evalData.evaluation_date)) {
    const err = new Error('Evaluasi hanya dapat diisi pada hari kerja (Senin s.d Jumat)');
    err.code = 'INVALID_INPUT';
    throw err;
  }

  // 4. Validasi Status Sesi Terkunci
  const session = await mentorSessionRepo.findByMentorAndDate(dbClient, mentorId, evalData.evaluation_date);
  if (session && session.is_submitted === 1) {
    const err = new Error('Sesi evaluasi pada tanggal ini sudah dikunci dan dikirim');
    err.code = 'DAILY_SESSION_LOCKED';
    throw err;
  }

  // 5. Simpan evaluasi ke database
  const success = await dailyEvalRepo.upsert(dbClient, evalData);

  if (success) {
    try {
      const student = await studentRepo.findById(dbClient, evalData.student_id);
      if (student) {
        // Hitung progres minggu aktif evaluasi
        const progress = studentService.calculatePklProgress(student.start_date, 4, evalData.evaluation_date);
        const activeWeek = progress.active_week;

        // Dapatkan range Senin s.d Minggu
        const { startDate: monStr } = studentService.getWeekDateRange(student.start_date, activeWeek);
        const monday = new Date(monStr);
        const friday = new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000);
        const friStr = friday.toISOString().split('T')[0];

        // Ambil summary poin dari database
        const summary = await dailyEvalRepo.getPointSummaryByWeek(dbClient, evalData.student_id, monStr, friStr);
        const totalPoints = summary.wkt_total + summary.skp_total + summary.has_total + summary.ker_total + summary.ini_total;

        // Dapatkan rekap mingguan yang sudah ada (jika ada) untuk mempertahankan comments & tags
        const weeklySummaryRepo = require('../repositories/weekly-summary.repository');
        const existingSummary = await weeklySummaryRepo.findByStudentAndWeek(dbClient, evalData.student_id, activeWeek);

        let finalTags = '[]';
        if (existingSummary && existingSummary.tags) {
          finalTags = typeof existingSummary.tags === 'string'
            ? existingSummary.tags
            : JSON.stringify(existingSummary.tags);
        }

        const summaryData = {
          student_id: evalData.student_id,
          week_number: activeWeek,
          total_points: totalPoints,
          comments: existingSummary ? existingSummary.comments : '',
          tags: finalTags,
          is_published: existingSummary ? existingSummary.is_published : 0
        };

        await weeklySummaryRepo.upsert(dbClient, summaryData);
      }
    } catch (syncErr) {
      console.error('⚠️ Gagal mensinkronisasikan total poin mingguan:', syncErr);
    }
  }

  return success;
}

module.exports = {
  isWorkday,
  saveDailyEvaluation
};
