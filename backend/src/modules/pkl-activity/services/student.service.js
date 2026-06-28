/**
 * @module StudentService
 * @description Business logic for PKL Student domain, progress calculations, and dashboard compositions.
 */

const studentRepo = require('../repositories/student.repository');
const taskRepo = require('../repositories/task.repository');
const dailyEvalRepo = require('../repositories/daily-evaluation.repository');
const weeklySumRepo = require('../repositories/weekly-summary.repository');

/**
 * Validasi apakah siswa yang diminta terafiliasi dengan mentor yang login (Data Ownership Check)
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {string} mentorId - ID Mentor (User ID pembimbing)
 * @throws {Error} Jika siswa tidak ditemukan atau tidak bimbingan mentor tersebut
 * @returns {Promise<boolean>} True jika terafiliasi
 */
async function validateMentorStudentOwnership(dbClient, studentId, mentorId) {
  const student = await studentRepo.findById(dbClient, studentId);
  if (!student) {
    const err = new Error('Siswa tidak ditemukan');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (student.mentor_id !== mentorId) {
    const err = new Error('Anda tidak memiliki akses ke data siswa ini');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return true;
}

/**
 * Menghitung progres minggu aktif PKL berdasarkan start_date dan total_weeks
 * @param {string} startDateStr - Tanggal Mulai PKL (YYYY-MM-DD)
 * @param {number} durationMonths - Durasi PKL dalam satuan bulan
 * @param {string} [currentDateStr] - Opsional tanggal saat ini (YYYY-MM-DD)
 * @returns {object} Berisi active_week, total_weeks, dan percentage progress
 */
function calculatePklProgress(startDateStr, durationMonths, currentDateStr) {
  const start = new Date(startDateStr);
  const now = currentDateStr ? new Date(currentDateStr) : new Date();

  // Hitung selisih hari
  const diffTime = Math.max(0, now.getTime() - start.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // 1 minggu = 7 hari
  let activeWeek = Math.floor(diffDays / 7) + 1;
  const totalWeeks = durationMonths * 4; // Ketentuan V1: 1 bulan = 4 minggu

  // Batasi activeWeek agar tidak kurang dari 1 atau melebihi totalWeeks
  if (activeWeek < 1) activeWeek = 1;
  const cappedActiveWeek = Math.min(activeWeek, totalWeeks);
  const percentage = Math.min(100, Math.max(0, Math.round((cappedActiveWeek / totalWeeks) * 100)));

  return {
    active_week: cappedActiveWeek,
    total_weeks: totalWeeks,
    percentage
  };
}

/**
 * Menentukan jenis pakaian harian siswa PKL berdasarkan hari dalam seminggu
 * @param {string} dateStr - Tanggal pengujian (YYYY-MM-DD)
 * @returns {string} Nama jenis pakaian
 */
function getClothesOfTheDay(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0: Minggu, 1: Senin, ..., 5: Jumat
  switch (day) {
    case 1: // Senin
    case 2: // Selasa
      return 'Kemeja Putih & Celana Bahan Hitam';
    case 3: // Rabu
    case 4: // Kamis
      return 'Wearpack Kejuruan';
    case 5: // Jumat
      return 'Batik & Celana Bahan Hitam';
    default:
      return 'Bebas / Kaos Sopan';
  }
}

/**
 * Mendapatkan rentang tanggal (Senin s.d Minggu) untuk minggu aktif relatif terhadap start_date siswa
 * @param {string} startDateStr - Tanggal Mulai PKL (YYYY-MM-DD)
 * @param {number} weekNumber - Nomor Minggu aktif
 * @returns {object} Berisi startDate dan endDate format YYYY-MM-DD
 */
function getWeekDateRange(startDateStr, weekNumber) {
  const start = new Date(startDateStr);
  // Mulai minggu ke-W: start_date + (W - 1) * 7 hari
  const weekStart = new Date(start.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000) - (24 * 60 * 60 * 1000));

  const format = (d) => d.toISOString().split('T')[0];
  return {
    startDate: format(weekStart),
    endDate: format(weekEnd)
  };
}

/**
 * Menyusun data respons dashboard aktif untuk Siswa (Student Dashboard Composition)
 * @param {object} dbClient - Database client/pool
 * @param {string} userId - ID User siswa
 * @param {string} todayDateStr - Tanggal hari ini (YYYY-MM-DD)
 * @returns {Promise<object>} Data struktur dashboard siswa
 */
async function getStudentDashboard(dbClient, userId, todayDateStr) {
  const student = await studentRepo.findByUserId(dbClient, userId);
  if (!student) {
    const err = new Error('Siswa tidak terdaftar');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // 1. Progress PKL
  const progress = calculatePklProgress(student.start_date, 4, todayDateStr); // Default 4 bulan (16 minggu)

  // 2. Info Kehadiran Hari Ini
  const tomorrow = new Date(todayDateStr);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const startTimestamp = `${todayDateStr}T00:00:00+07:00`;
  const endTimestamp = `${tomorrowStr}T00:00:00+07:00`;

  const [attendanceRows] = await dbClient.query(
    `SELECT status, waktu_absen FROM absensi 
     WHERE user_id = ? 
       AND waktu_absen >= ? 
       AND waktu_absen < ?
     ORDER BY waktu_absen ASC LIMIT 1`,
    [userId, startTimestamp, endTimestamp]
  );

  const attn = attendanceRows[0] || null;
  let attendanceStatus = '-';
  let attendanceTime = '-';
  if (attn) {
    attendanceStatus = attn.status;
    const dateObj = new Date(attn.waktu_absen);
    // Format to HH:mm Jakarta
    attendanceTime = dateObj.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace('.', ':');
  }

  const todayInfo = {
    date: todayDateStr,
    clothes: getClothesOfTheDay(todayDateStr),
    attendance_status: attendanceStatus,
    attendance_time: attendanceTime
  };

  // 3. Program Kerja & Tugas Minggu Aktif
  const allTasks = await taskRepo.findTasksByStudentId(dbClient, student.student_id);
  const activeWeekTasks = allTasks.filter(t => t.week_number === progress.active_week);
  
  // Dapatkan milestone title minggu aktif
  const weeks = await taskRepo.findWeeksByTemplateId(dbClient, student.program_template_id);
  const activeWeekMeta = weeks.find(w => w.week_number === progress.active_week);
  const milestoneTitle = activeWeekMeta ? activeWeekMeta.milestone_title : 'Milestone Mingguan';

  const programKerja = {
    title: milestoneTitle,
    tasks: activeWeekTasks.map(t => ({
      task_id: t.task_id,
      title: t.task_title,
      is_completed: t.is_completed === 1
    }))
  };

  // 4. Papan Apresiasi (Poin Reward)
  const summary = await weeklySumRepo.findByStudentAndWeek(dbClient, student.student_id, progress.active_week);
  let papanApresiasi = {
    is_published: false,
    message: 'Poin minggu ini sedang diproses oleh pembimbing.'
  };

  if (summary && summary.is_published === 1) {
    // Cari rentang tanggal minggu aktif untuk rekap aspek
    const range = getWeekDateRange(student.start_date, progress.active_week);
    const aspectsTotal = await dailyEvalRepo.getPointSummaryByWeek(dbClient, student.student_id, range.startDate, range.endDate);

    let parsedTags = [];
    try {
      parsedTags = summary.tags ? JSON.parse(summary.tags) : [];
    } catch (e) {
      parsedTags = summary.tags ? summary.tags.split(',') : [];
    }

    papanApresiasi = {
      is_published: true,
      total_points: summary.total_points,
      aspects: {
        wkt_point: aspectsTotal.wkt_total,
        skp_point: aspectsTotal.skp_total,
        has_point: aspectsTotal.has_total,
        ker_point: aspectsTotal.ker_total,
        ini_point: aspectsTotal.ini_total
      },
      feedback: {
        tags: parsedTags,
        comments: summary.comments || ''
      }
    };
  }

  return {
    today: todayInfo,
    progress,
    program_kerja: programKerja,
    papan_apresiasi: papanApresiasi
  };
}

/**
 * Menyusun data daftar siswa bimbingan untuk Mentor (Mentor Dashboard Composition)
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {string} dateStr - Tanggal evaluasi harian aktif (YYYY-MM-DD)
 * @returns {Promise<Array<object>>} Daftar siswa bimbingan beserta perolehan poin harian
 */
async function getMentorStudents(dbClient, mentorId, dateStr) {
  const rawList = await studentRepo.findStudentsWithDailyEvaluation(dbClient, mentorId, dateStr);
  
  return rawList.map(item => {
    const progress = calculatePklProgress(item.start_date, 4, dateStr);
    return {
      student_id: item.student_id,
      student_name: item.student_name,
      student_avatar: item.student_avatar,
      school_name: item.school_name,
      program_title: item.program_title,
      active_week: progress.active_week,
      evaluations: item.wkt_point !== null ? {
        wkt_point: item.wkt_point,
        skp_point: item.skp_point,
        has_point: item.has_point,
        ker_point: item.ker_point,
        ini_point: item.ini_point
      } : null
    };
  });
}

module.exports = {
  validateMentorStudentOwnership,
  calculatePklProgress,
  getClothesOfTheDay,
  getWeekDateRange,
  getStudentDashboard,
  getMentorStudents
};
