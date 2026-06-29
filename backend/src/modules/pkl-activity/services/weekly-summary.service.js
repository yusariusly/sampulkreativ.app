/**
 * @module WeeklySummaryService
 * @description Business logic for weekly summaries, feedback, tag validations, and batch publication.
 */

const studentRepo = require('../repositories/student.repository');
const dailyEvalRepo = require('../repositories/daily-evaluation.repository');
const weeklySumRepo = require('../repositories/weekly-summary.repository');
const studentService = require('./student.service');

/**
 * Mendapatkan daftar rekapitulasi mingguan seluruh siswa bimbingan mentor (Mencegah N+1)
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {number} weekNumber - Nomor Minggu aktif
 * @returns {Promise<Array<object>>} Daftar rekap mingguan
 */
async function getWeeklyRekapList(dbClient, mentorId, weekNumber) {
  // 1. Ambil semua siswa bimbingan mentor
  const students = await studentRepo.findByMentorId(dbClient, mentorId);
  if (students.length === 0) return [];

  // 2. Ambil seluruh data summary mingguan yang sudah disimpan
  const summaries = await weeklySumRepo.findWeeklySummariesByMentor(dbClient, mentorId, weekNumber);
  const summaryMap = new Map(summaries.map(s => [s.student_id, s]));

  // 3. Ambil seluruh daily evaluations untuk semua siswa (Mencegah N+1)
  const [evalRows] = await dbClient.query(`
    SELECT student_id, evaluation_date, wkt_point, skp_point, has_point, ker_point, ini_point
    FROM pkl_daily_evaluations
  `);

  // Kelompokkan data evaluasi berdasarkan student_id
  const evalMap = new Map();
  for (const row of evalRows) {
    if (!evalMap.has(row.student_id)) {
      evalMap.set(row.student_id, []);
    }
    evalMap.get(row.student_id).push(row);
  }

  // 4. Proses kompilasi data untuk masing-masing siswa
  const result = [];
  for (const student of students) {
    const range = studentService.getWeekDateRange(student.start_date, weekNumber);
    const studentEvals = evalMap.get(student.student_id) || [];
    
    // Filter evaluasi yang jatuh dalam rentang minggu terkait
    const weekEvals = studentEvals.filter(e => e.evaluation_date >= range.startDate && e.evaluation_date <= range.endDate);
    
    // Hitung total poin aktual dari evaluasi harian
    let calculatedPoints = 0;
    for (const ev of weekEvals) {
      calculatedPoints += (ev.wkt_point || 0) + (ev.skp_point || 0) + (ev.has_point || 0) + (ev.ker_point || 0) + (ev.ini_point || 0);
    }

    // Ambil rekap tersimpan jika ada
    const savedSummary = summaryMap.get(student.student_id);
    let tags = [];
    if (savedSummary && savedSummary.tags) {
      try {
        tags = typeof savedSummary.tags === 'string' ? JSON.parse(savedSummary.tags) : savedSummary.tags;
      } catch (e) {
        tags = savedSummary.tags.split(',').filter(Boolean);
      }
    }

    result.push({
      student_id: student.student_id,
      student_name: student.student_name,
      school_name: student.school_name,
      start_date: student.start_date,
      week_number: weekNumber,
      total_points: savedSummary ? savedSummary.total_points : calculatedPoints,
      comments: savedSummary ? (savedSummary.comments || '') : '',
      tags: tags,
      is_published: savedSummary ? (savedSummary.is_published === 1) : false
    });
  }

  return result;
}

/**
 * Menyimpan draf feedback mingguan (tags & komentar) untuk siswa tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {string} studentId - ID Siswa PKL
 * @param {object} feedbackData - Payload umpan balik
 * @param {number} feedbackData.week_number - Nomor Minggu
 * @param {Array<string>} feedbackData.tags - Tag apresiasi cepat (misal: ["Disiplin"])
 * @param {string} [feedbackData.comments] - Catatan umpan balik tertulis
 * @throws {Error} Jika kepemilikan salah atau tag kosong
 * @returns {Promise<object>} Status penyimpanan dan warning jika ada
 */
async function saveWeeklyFeedback(dbClient, mentorId, studentId, feedbackData) {
  // 1. Cek kepemilikan siswa
  await studentService.validateMentorStudentOwnership(dbClient, studentId, mentorId);

  // 2. Validasi minimal 1 tag wajib diisi
  if (!feedbackData.tags || !Array.isArray(feedbackData.tags) || feedbackData.tags.length === 0) {
    const err = new Error('Tag apresiasi cepat minimal harus dipilih satu');
    err.code = 'INVALID_INPUT';
    throw err;
  }

  // 3. Cari profil siswa untuk menghitung rentang tanggal minggu
  const student = await studentRepo.findById(dbClient, studentId);
  const range = studentService.getWeekDateRange(student.start_date, feedbackData.week_number);

  // 4. Hitung total poin dari evaluasi harian
  const summaryPoints = await dailyEvalRepo.getPointSummaryByWeek(dbClient, studentId, range.startDate, range.endDate);
  const totalPoints = summaryPoints.wkt_total + summaryPoints.skp_total + summaryPoints.has_total + summaryPoints.ker_total + summaryPoints.ini_total;

  // 5. Validasi Comments (warning jika poin < 12 dan komentar kosong)
  let warningMessage = null;
  if (totalPoints < 12 && (!feedbackData.comments || feedbackData.comments.trim() === '')) {
    warningMessage = 'Catatan umpan balik direkomendasikan untuk siswa dengan perolehan poin di bawah 12.';
  }

  // 6. Lakukan upsert ke database
  const summaryPayload = {
    student_id: studentId,
    week_number: feedbackData.week_number,
    total_points: totalPoints,
    comments: feedbackData.comments || null,
    tags: JSON.stringify(feedbackData.tags),
    is_published: 0 // Default draf saat disimpan
  };

  const success = await weeklySumRepo.upsert(dbClient, summaryPayload);
  return {
    success,
    warning: warningMessage
  };
}

/**
 * Mempublikasikan rekap mingguan untuk semua siswa bimbingan mentor pada minggu terkait
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {number} weekNumber - Nomor Minggu aktif
 * @throws {Error} Jika ada siswa bimbingan yang belum mengisi tag apresiasi cepat
 * @returns {Promise<boolean>} True jika publikasi berhasil
 */
async function publishWeeklySummary(dbClient, mentorId, weekNumber) {
  // 1. Ambil daftar rekap mingguan mentor (sudah bebas dari N+1)
  const list = await getWeeklyRekapList(dbClient, mentorId, weekNumber);
  
  if (list.length === 0) {
    const err = new Error('Tidak ada siswa bimbingan untuk dipublikasikan');
    err.code = 'INVALID_INPUT';
    throw err;
  }

  // 2. Validasi: Semua siswa wajib memiliki setidaknya 1 tag apresiasi di draf rekap mingguan
  const uncompleted = list.filter(item => item.tags.length === 0);
  if (uncompleted.length > 0) {
    const names = uncompleted.map(item => item.student_name).join(', ');
    const err = new Error(`Gagal publikasi. Siswa berikut belum diisi tag apresiasi cepat: ${names}`);
    err.code = 'INVALID_INPUT';
    throw err;
  }

  // 3. Update status is_published = 1 untuk seluruh siswa bimbingan mentor pada minggu tersebut
  const success = await weeklySumRepo.publishAllByMentor(dbClient, mentorId, weekNumber);
  return success;
}

/**
 * Menyembunyikan (membatalkan publikasi) rekap mingguan untuk semua siswa bimbingan mentor pada minggu terkait
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {number} weekNumber - Nomor Minggu aktif
 * @returns {Promise<boolean>} True jika pembatalan publikasi berhasil
 */
async function unpublishWeeklySummary(dbClient, mentorId, weekNumber) {
  const success = await weeklySumRepo.unpublishAllByMentor(dbClient, mentorId, weekNumber);
  return success;
}

module.exports = {
  getWeeklyRekapList,
  saveWeeklyFeedback,
  publishWeeklySummary,
  unpublishWeeklySummary
};
