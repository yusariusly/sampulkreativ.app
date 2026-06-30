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

  // Dapatkan Senin dari start week
  const startDay = start.getDay();
  const diffToMondayStart = startDay === 0 ? -6 : 1 - startDay;
  const mondayOfStartWeek = new Date(start);
  mondayOfStartWeek.setDate(start.getDate() + diffToMondayStart);
  mondayOfStartWeek.setHours(0, 0, 0, 0);

  // Dapatkan Senin dari target week
  const targetDay = now.getDay();
  const diffToMondayTarget = targetDay === 0 ? -6 : 1 - targetDay;
  const mondayOfTargetWeek = new Date(now);
  mondayOfTargetWeek.setDate(now.getDate() + diffToMondayTarget);
  mondayOfTargetWeek.setHours(0, 0, 0, 0);

  // Hitung selisih hari antara kedua Senin tersebut
  const diffTime = mondayOfTargetWeek.getTime() - mondayOfStartWeek.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
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
 * @param {object} dbClient - Database client/pool
 * @param {string} dateStr - Tanggal pengujian (YYYY-MM-DD)
 * @returns {Promise<string>} Nama jenis pakaian
 */
async function getClothesOfTheDay(dbClient, dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0: Minggu, 1: Senin, ..., 5: Jumat, 6: Sabtu

  try {
    const [rows] = await dbClient.query('SELECT clothes_description FROM pkl_dress_code WHERE day_number = ?', [day]);
    if (rows && rows.length > 0) {
      return rows[0].clothes_description;
    }
  } catch (error) {
    console.warn('[DressCode] Gagal mengambil dari DB, menggunakan fallback:', error.message);
  }

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
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const mondayOfStartWeek = new Date(start);
  mondayOfStartWeek.setDate(start.getDate() + diffToMonday);

  const targetMonday = new Date(mondayOfStartWeek);
  targetMonday.setDate(mondayOfStartWeek.getDate() + (weekNumber - 1) * 7);

  const targetSunday = new Date(targetMonday);
  targetSunday.setDate(targetMonday.getDate() + 6); // Senin s.d Minggu

  const format = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${date}`;
  };

  return {
    startDate: format(targetMonday),
    endDate: format(targetSunday)
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
  if (!student || student.status !== 'ACTIVE') {
    const err = new Error('Siswa tidak terdaftar atau profil PKL tidak aktif');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // 1. Progress PKL
  const progress = calculatePklProgress(student.start_date, student.duration_months || 4, todayDateStr);

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
    clothes: await getClothesOfTheDay(dbClient, todayDateStr),
    attendance_status: attendanceStatus,
    attendance_time: attendanceTime
  };

  // 3. Program Kerja & Tugas Minggu Aktif
  const allTasks = await taskRepo.findTasksByStudentId(dbClient, student.student_id);
  const activeWeekTasks = allTasks.filter(t => t.week_number === progress.active_week);
  
  // Dapatkan semua minggu dari program template
  const weeks = await taskRepo.findWeeksByTemplateId(dbClient, student.program_template_id);
  
  // Susun data minggu beserta tugasnya
  const weeksWithTasks = weeks.map(w => {
    const weekTasks = allTasks.filter(t => t.week_id === w.id);
    return {
      id: w.id,
      week_number: w.week_number,
      month_number: w.month_number,
      milestone_title: w.milestone_title,
      tasks: weekTasks.map(t => ({
        task_id: t.task_id,
        title: t.task_title,
        is_completed: t.is_completed === 1,
        is_mandatory: t.is_mandatory === 1
      }))
    };
  });

  const activeWeekMeta = weeks.find(w => w.week_number === progress.active_week);
  const milestoneTitle = activeWeekMeta ? activeWeekMeta.milestone_title : 'Aktivitas Mingguan';

  const programKerja = {
    title: milestoneTitle,
    tasks: activeWeekTasks.map(t => ({
      task_id: t.task_id,
      title: t.task_title,
      is_completed: t.is_completed === 1
    })),
    active_week: progress.active_week,
    weeks: weeksWithTasks
  };

  // 4. Papan Apresiasi (Poin Reward)
  const [settingsRows] = await dbClient.query("SELECT key_value FROM settings WHERE key_name = 'show_pkl_scoreboard' LIMIT 1");
  const showPklScoreboard = settingsRows.length > 0 ? settingsRows[0].key_value === '1' : true;

  let summary = await weeklySumRepo.findByStudentAndWeek(dbClient, student.student_id, progress.active_week);
  let displayedWeek = progress.active_week;

  if (!summary || (summary.is_published !== 1 && summary.is_published !== true)) {
    // Fallback: ambil rekap terpublikasi terakhir
    const latestPublished = await weeklySumRepo.findLatestPublished(dbClient, student.student_id);
    if (latestPublished) {
      summary = latestPublished;
      displayedWeek = latestPublished.week_number;
    }
  }

  let papanApresiasi = {
    is_published: false,
    message: 'Poin minggu ini sedang diproses oleh pembimbing.'
  };

  if (showPklScoreboard && summary && (summary.is_published === 1 || summary.is_published === true)) {
    // Cari rentang tanggal minggu yang ditampilkan untuk rekap aspek
    const range = getWeekDateRange(student.start_date, displayedWeek);
    const aspectsTotal = await dailyEvalRepo.getPointSummaryByWeek(dbClient, student.student_id, range.startDate, range.endDate);

    let parsedTags = [];
    try {
      parsedTags = summary.tags ? JSON.parse(summary.tags) : [];
    } catch (e) {
      parsedTags = summary.tags ? summary.tags.split(',') : [];
    }

    let baselineStartStr = student.start_date;
    try {
      const [minStartRes] = await dbClient.query(
        "SELECT MIN(start_date) as min_start FROM pkl_students WHERE status = 'ACTIVE'"
      );
      const baselineStart = minStartRes[0]?.min_start || student.start_date;
      baselineStartStr = new Date(baselineStart).toISOString().split('T')[0];
    } catch (err) {
      console.warn('[CohortWeekForThisRange] Gagal mendapatkan min_start:', err.message);
    }
    const cohortWeekForThisRange = calculatePklProgress(baselineStartStr, 4, range.startDate).active_week;

    papanApresiasi = {
      is_published: true,
      week_number: displayedWeek,
      cohort_week_number: cohortWeekForThisRange,
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

  // Load dynamic aspect settings
  let aspectSettings = [];
  try {
    const [aspectRows] = await dbClient.query('SELECT aspect_key, label, icon_name, is_active FROM pkl_aspect_settings');
    aspectSettings = aspectRows;
  } catch (err) {
    console.warn('[AspectSettings] Gagal memuat dari DB:', err.message);
  }

  // 5. Hitung cohort active week (minggu berjalan cohort) berdasarkan siswa aktif pertama
  let cohortActiveWeek = progress.active_week;
  try {
    const [minStartRes] = await dbClient.query(
      "SELECT MIN(start_date) as min_start FROM pkl_students WHERE status = 'ACTIVE'"
    );
    const baselineStart = minStartRes[0]?.min_start || student.start_date;
    const baselineStartStr = new Date(baselineStart).toISOString().split('T')[0];
    const cohortProgress = calculatePklProgress(baselineStartStr, 4, todayDateStr);
    cohortActiveWeek = cohortProgress.active_week;
  } catch (err) {
    console.warn('[CohortActiveWeek] Gagal menghitung:', err.message);
  }

  return {
    start_date: student.start_date,
    today: todayInfo,
    progress,
    program_kerja: programKerja,
    papan_apresiasi: papanApresiasi,
    aspect_settings: aspectSettings,
    show_pkl_scoreboard: showPklScoreboard,
    cohort_active_week: cohortActiveWeek
  };
}

/**
 * Menyusun data daftar siswa bimbingan untuk Mentor (Mentor Dashboard Composition)
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {string} dateStr - Tanggal evaluasi harian aktif (YYYY-MM-DD)
 * @param {string} [startDate] - Tanggal awal rentang (YYYY-MM-DD)
 * @param {string} [endDate] - Tanggal akhir rentang (YYYY-MM-DD)
 * @returns {Promise<Array<object>>} Daftar siswa bimbingan beserta perolehan poin harian
 */
async function getMentorStudents(dbClient, mentorId, dateStr, startDate, endDate) {
  if (startDate && endDate) {
    const students = await studentRepo.findByMentorId(dbClient, mentorId);
    const [evaluations] = await dbClient.query(
      `SELECT id, student_id, evaluation_date, wkt_point, skp_point, has_point, ker_point, ini_point 
       FROM pkl_daily_evaluations 
       WHERE student_id IN (SELECT id FROM pkl_students WHERE status = 'ACTIVE') 
         AND evaluation_date BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const evalsGrouped = {};
    evaluations.forEach(ev => {
      const dateKey = typeof ev.evaluation_date === 'string'
        ? ev.evaluation_date
        : ev.evaluation_date.toISOString().split('T')[0];

      if (!evalsGrouped[ev.student_id]) {
        evalsGrouped[ev.student_id] = [];
      }
      evalsGrouped[ev.student_id].push({
        evaluation_date: dateKey,
        wkt_point: Number(ev.wkt_point),
        skp_point: Number(ev.skp_point),
        has_point: Number(ev.has_point),
        ker_point: Number(ev.ker_point),
        ini_point: Number(ev.ini_point)
      });
    });

    return students.map(item => {
      const progress = calculatePklProgress(item.start_date, 4, dateStr);
      return {
        student_id: item.student_id,
        student_name: item.student_name,
        student_avatar: item.student_avatar,
        school_name: item.school_name,
        program_title: item.program_title,
        active_week: progress.active_week,
        evaluations: evalsGrouped[item.student_id] || []
      };
    });
  }

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
