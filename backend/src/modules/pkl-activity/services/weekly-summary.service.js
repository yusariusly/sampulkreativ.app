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

  // 2. Dapatkan baseline start_date dinamis (paling awal) dari siswa aktif
  const [minStartRes] = await dbClient.query(
    "SELECT MIN(start_date) as min_start FROM pkl_students WHERE status = 'ACTIVE'"
  );
  const baselineStart = minStartRes[0]?.min_start || new Date("2026-06-29");
  const baselineStartStr = new Date(baselineStart).toISOString().split('T')[0];

  // 3. Ambil seluruh data summary mingguan yang sudah disimpan untuk seluruh siswa bimbingan sekaligus
  const studentIds = students.map(s => s.student_id);
  const [summaryRows] = await dbClient.query(
    'SELECT id, student_id, week_number, total_points, comments, tags, is_published FROM pkl_weekly_summaries WHERE student_id IN (?)',
    [studentIds]
  );
  const summaryMap = new Map(summaryRows.map(s => [`${s.student_id}_${s.week_number}`, s]));

  // 4. Ambil seluruh daily evaluations untuk semua siswa (Mencegah N+1)
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

  // 5. Proses kompilasi data untuk masing-masing siswa
  const result = [];
  for (const student of students) {
    const range = studentService.getWeekDateRange(baselineStartStr, weekNumber);
    const studentEvals = evalMap.get(student.student_id) || [];
    
    // Filter evaluasi yang jatuh dalam rentang minggu terkait
    const weekEvals = studentEvals.filter(e => {
      const evalDateStr = e.evaluation_date instanceof Date
        ? e.evaluation_date.toISOString().split('T')[0]
        : new Date(e.evaluation_date).toISOString().split('T')[0];
      return evalDateStr >= range.startDate && evalDateStr <= range.endDate;
    });
    
    // Hitung total poin aktual dari evaluasi harian
    let calculatedPoints = 0;
    for (const ev of weekEvals) {
      calculatedPoints += (ev.wkt_point || 0) + (ev.skp_point || 0) + (ev.has_point || 0) + (ev.ker_point || 0) + (ev.ini_point || 0);
    }

    // Hitung range hari Senin - Jumat untuk week ini
    const daysList = [];
    const start = new Date(range.startDate);
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      daysList.push(d.toISOString().split('T')[0]);
    }

    const daysStatus = daysList.map(dateStr => {
      const studentStartStr = new Date(student.start_date).toISOString().split('T')[0];
      if (dateStr < studentStartStr) {
        return -1; // Belum PKL
      }
      const ev = weekEvals.find(e => {
        const evalDateStr = e.evaluation_date instanceof Date
          ? e.evaluation_date.toISOString().split('T')[0]
          : new Date(e.evaluation_date).toISOString().split('T')[0];
        return evalDateStr === dateStr;
      });
      if (ev) {
        const totalPoints = (ev.wkt_point || 0) + (ev.skp_point || 0) + (ev.has_point || 0) + (ev.ker_point || 0) + (ev.ini_point || 0);
        if (totalPoints > 0) return 1; // Terisi
      }
      return 0; // Belum terisi
    });

    // Hitung week_number relatif siswa untuk pekan cohort ini
    const progress = studentService.calculatePklProgress(student.start_date, 4, range.startDate);
    const relativeWeek = progress.active_week;

    // Ambil rekap tersimpan jika ada berdasarkan relativeWeek
    const savedSummary = summaryMap.get(`${student.student_id}_${relativeWeek}`);
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
      relative_week_number: relativeWeek,
      total_points: calculatedPoints, // Selalu gunakan poin kalkulasi riil agar terhindar dari desinkronisasi
      comments: savedSummary ? (savedSummary.comments || '') : '',
      tags: tags,
      is_published: savedSummary ? (savedSummary.is_published === 1) : false,
      days_status: daysStatus
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

  // 3. Cari profil siswa untuk menghitung rentang tanggal minggu berdasarkan cohort baseline
  const student = await studentRepo.findById(dbClient, studentId);
  const [minStartRes] = await dbClient.query(
    "SELECT MIN(start_date) as min_start FROM pkl_students WHERE status = 'ACTIVE'"
  );
  const baselineStart = minStartRes[0]?.min_start || student.start_date;
  const baselineStartStr = new Date(baselineStart).toISOString().split('T')[0];
  const range = studentService.getWeekDateRange(baselineStartStr, feedbackData.week_number);

  // Hitung week_number relatif siswa untuk pekan cohort ini
  const progress = studentService.calculatePklProgress(student.start_date, 4, range.startDate);
  const relativeWeek = progress.active_week;

  // 4. Hitung total poin dari evaluasi harian
  const summaryPoints = await dailyEvalRepo.getPointSummaryByWeek(dbClient, studentId, range.startDate, range.endDate);
  const totalPoints = summaryPoints.wkt_total + summaryPoints.skp_total + summaryPoints.has_total + summaryPoints.ker_total + summaryPoints.ini_total;

  // 5. Validasi Comments (warning jika poin < 12 dan komentar kosong)
  let warningMessage = null;
  if (totalPoints < 12 && (!feedbackData.comments || feedbackData.comments.trim() === '')) {
    warningMessage = 'Catatan umpan balik direkomendasikan untuk siswa dengan perolehan poin di bawah 12.';
  }

  // 6. Lakukan upsert ke database menggunakan relative_week
  const summaryPayload = {
    student_id: studentId,
    week_number: relativeWeek,
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

  // 3. Update status is_published = 1 untuk masing-masing siswa berdasarkan pekan relatif mereka
  for (const item of list) {
    await weeklySumRepo.publish(dbClient, item.student_id, item.relative_week_number);
  }
  return true;
}

/**
 * Menyembunyikan (membatalkan publikasi) rekap mingguan untuk semua siswa bimbingan mentor pada minggu terkait
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {number} weekNumber - Nomor Minggu aktif
 * @returns {Promise<boolean>} True jika pembatalan publikasi berhasil
 */
async function unpublishWeeklySummary(dbClient, mentorId, weekNumber) {
  const list = await getWeeklyRekapList(dbClient, mentorId, weekNumber);
  for (const item of list) {
    await dbClient.query(
      'UPDATE pkl_weekly_summaries SET is_published = 0, updated_at = NOW() WHERE student_id = ? AND week_number = ?',
      [item.student_id, item.relative_week_number]
    );
  }
  return true;
}

module.exports = {
  getWeeklyRekapList,
  saveWeeklyFeedback,
  publishWeeklySummary,
  unpublishWeeklySummary
};
