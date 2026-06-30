/**
 * @module ScoreboardService
 * @description Business logic for computing PKL scoreboard rankings, tie-breakers, auto badges, rank movement, and visibility settings.
 */

const studentRepo = require('../repositories/student.repository');
const studentService = require('./student.service');

/**
 * Mengambil status visibilitas global scoreboard dari tabel settings
 * @param {object} dbClient 
 * @returns {Promise<boolean>}
 */
async function getScoreboardVisibility(dbClient) {
  try {
    const [rows] = await dbClient.query("SELECT key_value FROM settings WHERE key_name = 'show_pkl_scoreboard' LIMIT 1");
    if (rows.length > 0) {
      return rows[0].key_value === '1';
    }
    return true; // Default true jika setting belum terdaftar
  } catch (error) {
    console.error('Gagal mengambil visibilitas scoreboard:', error);
    return true;
  }
}

/**
 * Menyembunyikan/menampilkan scoreboard secara global
 * @param {object} dbClient 
 * @param {boolean} showScoreboard 
 * @returns {Promise<boolean>}
 */
async function toggleScoreboardVisibility(dbClient, showScoreboard) {
  const val = showScoreboard ? '1' : '0';
  const [result] = await dbClient.query(
    "INSERT INTO settings (key_name, key_value) VALUES ('show_pkl_scoreboard', ?) ON DUPLICATE KEY UPDATE key_value = ?",
    [val, val]
  );
  return result.affectedRows > 0;
}

/**
 * Sensor nama belakang untuk menjaga privasi antar siswa
 * @param {string} fullName 
 * @returns {string}
 */
function maskStudentName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  // Ambil kata pertama lengkap, kata berikutnya hanya huruf pertamanya diikuti titik
  const firstName = parts[0];
  const lastInitial = parts[1][0].toUpperCase() + '.';
  return `${firstName} ${lastInitial}`;
}

/**
 * Menentukan badge gamifikasi otomatis berdasarkan evaluasi mingguan harian siswa
 * @param {Array<object>} weekEvals - Evaluasi harian dalam minggu tersebut
 * @returns {Array<string>} Daftar nama badge
 */
function determineAutoBadges(weekEvals) {
  const badges = [];
  if (weekEvals.length === 0) return badges;

  let perfectDays = 0;
  let wktMaxDays = 0;
  let iniMaxDays = 0;
  let hasMaxDays = 0;
  let kerMaxDays = 0;

  for (const ev of weekEvals) {
    const totalDayPoints = (ev.wkt_point || 0) + (ev.skp_point || 0) + (ev.has_point || 0) + (ev.ker_point || 0) + (ev.ini_point || 0);
    // Hari sempurna jika poin hari itu >= 5
    if (totalDayPoints >= 5) perfectDays++;

    if (ev.wkt_point >= 1) wktMaxDays++;
    if (ev.ini_point >= 1) iniMaxDays++;
    if (ev.has_point >= 1) hasMaxDays++;
    if (ev.ker_point >= 1) kerMaxDays++;
  }

  // 1. Consistent
  if (perfectDays >= 4) badges.push('Consistent');

  // 2. Discipline
  if (wktMaxDays >= 5) badges.push('Discipline');

  // 3. Creative
  if (iniMaxDays >= 5 || hasMaxDays >= 5) badges.push('Creative');

  // 4. Team Player
  if (kerMaxDays >= 5) badges.push('Team Player');

  // 5. Initiative
  if (iniMaxDays >= 5) badges.push('Initiative');

  // 6. Problem Solver
  if (hasMaxDays >= 5 && iniMaxDays >= 4) badges.push('Problem Solver');

  // Hapus duplikasi jika ada (misal Creative dan Initiative sama-sama terdeteksi)
  return [...new Set(badges)];
}

async function computeRankingsForWeek(dbClient, students, cohortWeekNumber) {
  if (students.length === 0) return [];

  // 1. Dapatkan baseline start_date dinamis (paling awal) dari siswa aktif
  const [minStartRes] = await dbClient.query(
    "SELECT MIN(start_date) as min_start FROM pkl_students WHERE status = 'ACTIVE'"
  );
  const baselineStart = minStartRes[0]?.min_start || new Date("2026-06-29");
  const baselineStartStr = new Date(baselineStart).toISOString().split('T')[0];

  // 2. Tentukan range tanggal kalender untuk Cohort Week ini
  const cohortRange = studentService.getWeekDateRange(baselineStartStr, cohortWeekNumber);

  // 3. Ambil semua weekly summaries untuk siswa-siswa ini sekaligus
  const studentIds = students.map(s => s.student_id);
  const [sumRows] = await dbClient.query(
    'SELECT student_id, week_number, total_points, tags, created_at FROM pkl_weekly_summaries WHERE is_published = 1 AND student_id IN (?)',
    [studentIds]
  );
  
  // Buat Map berdasarkan student_id dan relative week_number
  const summaryMap = new Map(
    sumRows.map(s => [`${s.student_id}_${s.week_number}`, s])
  );

  // 4. Ambil semua daily evaluations untuk range tanggal kalender ini sekaligus
  const [evalRows] = await dbClient.query(
    'SELECT student_id, evaluation_date, wkt_point, skp_point, has_point, ker_point, ini_point FROM pkl_daily_evaluations WHERE evaluation_date BETWEEN ? AND ? AND student_id IN (?)',
    [cohortRange.startDate, cohortRange.endDate, studentIds]
  );

  // Group daily evaluations by student_id
  const evalMap = new Map();
  for (const ev of evalRows) {
    if (!evalMap.has(ev.student_id)) {
      evalMap.set(ev.student_id, []);
    }
    evalMap.get(ev.student_id).push(ev);
  }

  const results = [];
  for (const student of students) {
    // Cek apakah siswa sudah mulai PKL pada pekan ini
    const studentStart = new Date(student.start_date);
    const cohortEnd = new Date(cohortRange.endDate);
    
    // Jika start date siswa di masa depan relatif terhadap akhir pekan cohort ini, mereka belum mulai
    if (studentStart > cohortEnd) {
      continue; // Skip student, belum mulai PKL
    }

    // Hitung week_number relatif siswa untuk pekan cohort ini
    // Kita gunakan tanggal awal pekan cohort (cohortRange.startDate) untuk mengevaluasi pekan relatif
    const progress = studentService.calculatePklProgress(student.start_date, 4, cohortRange.startDate);
    const relativeWeek = progress.active_week;

    // Ambil daily evaluations yang sudah dikelompokkan
    const evals = evalMap.get(student.student_id) || [];

    // Hitung perfect days & calculated points dari daily evaluations
    let perfectDays = 0;
    let calculatedPoints = 0;
    for (const ev of evals) {
      const dayTotal = (ev.wkt_point || 0) + (ev.skp_point || 0) + (ev.has_point || 0) + (ev.ker_point || 0) + (ev.ini_point || 0);
      if (dayTotal >= 5) perfectDays++;
      calculatedPoints += dayTotal;
    }

    const savedSummary = summaryMap.get(`${student.student_id}_${relativeWeek}`);
    const finalPoints = savedSummary ? savedSummary.total_points : calculatedPoints;

    let manualTags = [];
    if (savedSummary && savedSummary.tags) {
      try {
        manualTags = typeof savedSummary.tags === 'string' ? JSON.parse(savedSummary.tags) : savedSummary.tags;
      } catch (e) {
        manualTags = savedSummary.tags.split(',').filter(Boolean);
      }
    }

    const autoBadges = determineAutoBadges(evals);
    const allBadges = [...new Set([...manualTags, ...autoBadges])];

    results.push({
      student_id: student.student_id,
      student_name: student.student_name,
      student_avatar: student.student_avatar,
      profile_photo: student.student_avatar,
      school_name: student.school_name,
      program_template_id: student.program_template_id,
      total_points: finalPoints,
      perfect_days: perfectDays,
      badges: allBadges,
      badges_count: allBadges.length,
      submission_time: savedSummary ? new Date(savedSummary.created_at).getTime() : Date.now()
    });
  }

  // Urutkan berdasarkan Ranking Rules:
  // 1. total_points DESC
  // 2. perfect_days DESC
  // 3. badges_count DESC
  // 4. submission_time ASC
  results.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.perfect_days !== a.perfect_days) return b.perfect_days - a.perfect_days;
    if (b.badges_count !== a.badges_count) return b.badges_count - a.badges_count;
    return a.submission_time - b.submission_time;
  });

  // Tetapkan peringkat
  let currentRank = 1;
  for (let i = 0; i < results.length; i++) {
    if (i > 0) {
      const prev = results[i - 1];
      const curr = results[i];
      const isEqual = curr.total_points === prev.total_points &&
                      curr.perfect_days === prev.perfect_days &&
                      curr.badges_count === prev.badges_count &&
                      curr.submission_time === prev.submission_time;
      if (!isEqual) {
        currentRank = i + 1;
      }
    }
    results[i].rank = currentRank;
  }

  return results;
}

/**
 * Mengambil data scoreboard utama beserta peringkat & movement
 * @param {object} dbClient 
 * @param {object} user - Requesting User
 * @param {number} weekNumber - Nomor Minggu aktif
 * @returns {Promise<object>} Data scoreboard
 */
async function getScoreboard(dbClient, user, weekNumber) {
  const isStudent = user.role === 'student';
  const showScoreboard = await getScoreboardVisibility(dbClient);

  // Jika disembunyikan oleh admin dan pemohon adalah siswa, kembalikan locked status
  if (!showScoreboard && isStudent) {
    return {
      week_number: weekNumber,
      show_scoreboard: false,
      rankings: []
    };
  }

  // 1. Ambil target siswa berdasarkan role
  let students = [];
  let userStudentProfile = null;

  if (isStudent) {
    // Ambil profil siswa bersangkutan
    userStudentProfile = await studentRepo.findByUserId(dbClient, user.id);
    if (!userStudentProfile) {
      const err = new Error('Siswa tidak terdaftar');
      err.code = 'NOT_FOUND';
      throw err;
    }
    // Ambil semua siswa PKL (global, karena role mentor sudah didepresiasi)
    students = await studentRepo.findByMentorId(dbClient, null);
  } else {
    // Admin melihat seluruh siswa
    students = await studentRepo.findAll(dbClient);
  }

  // 2. Hitung ranking minggu ini
  const rankingsThisWeek = await computeRankingsForWeek(dbClient, students, weekNumber);

  // 3. Hitung ranking minggu lalu untuk mendapatkan movement
  let rankingsLastWeek = [];
  if (weekNumber > 1) {
    rankingsLastWeek = await computeRankingsForWeek(dbClient, students, weekNumber - 1);
  }
  const lastWeekRankMap = new Map(rankingsLastWeek.map(r => [r.student_id, r.rank]));

  // 4. Petakan hasil final & sensor nama jika diperlukan
  const finalRankings = rankingsThisWeek.map(curr => {
    const lastRank = lastWeekRankMap.get(curr.student_id);
    let movement = 0;
    if (lastRank !== undefined) {
      movement = lastRank - curr.rank; // Positif berarti naik (misal dari rank 3 ke rank 1)
    }

    const isSelf = isStudent && curr.student_id === userStudentProfile.student_id;
    const finalName = (isStudent && !isSelf) ? maskStudentName(curr.student_name) : curr.student_name;

    return {
      student_id: curr.student_id,
      student_name: finalName,
      student_avatar: curr.student_avatar,
      profile_photo: curr.student_avatar,
      school_name: curr.school_name,
      program_template_id: curr.program_template_id,
      total_points: curr.total_points,
      perfect_days: curr.perfect_days,
      badges: curr.badges,
      rank: curr.rank,
      rank_movement: movement,
      rank_change: movement,
      is_self: isSelf
    };
  });

  return {
    week_number: weekNumber,
    show_scoreboard: showScoreboard,
    rankings: finalRankings
  };
}

/**
 * Mengambil riwayat peringkat mingguan siswa tertentu
 * @param {object} dbClient 
 * @param {string} studentId 
 * @returns {Promise<Array<object>>} History array
 */
async function getStudentScoreboardHistory(dbClient, studentId) {
  // Verifikasi siswa ada
  const [stuRows] = await dbClient.query("SELECT start_date FROM pkl_students WHERE id = ? AND status = 'ACTIVE' LIMIT 1", [studentId]);
  if (stuRows.length === 0) {
    const err = new Error('Siswa tidak ditemukan');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Ambil semua siswa PKL (global)
  const students = await studentRepo.findByMentorId(dbClient, null);

  // Cari semua minggu aktif yang sudah dirilis summary-nya
  const [weekRows] = await dbClient.query(
    "SELECT DISTINCT week_number FROM pkl_weekly_summaries WHERE is_published = 1 AND student_id IN (SELECT id FROM pkl_students WHERE status = 'ACTIVE') ORDER BY week_number ASC"
  );

  const history = [];
  for (const w of weekRows) {
    const rankings = await computeRankingsForWeek(dbClient, students, w.week_number);
    const selfRank = rankings.find(r => r.student_id === studentId);
    if (selfRank) {
      history.push({
        week_number: w.week_number,
        rank: selfRank.rank,
        total_points: selfRank.total_points,
        perfect_days: selfRank.perfect_days
      });
    }
  }

  return history;
}

module.exports = {
  getScoreboardVisibility,
  toggleScoreboardVisibility,
  getScoreboard,
  getStudentScoreboardHistory
};
