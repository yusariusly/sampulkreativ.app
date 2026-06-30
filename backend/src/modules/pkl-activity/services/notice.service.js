/**
 * @module NoticeService
 * @description Business logic for computing Reward & Punishment notice recipients, managing notices, and verifying Friday locks.
 */

const noticeRepo = require('../repositories/notice.repository');
const studentRepo = require('../repositories/student.repository');
const scoreboardService = require('./scoreboard.service');
const studentService = require('./student.service');

/**
 * Mendapatkan notice aktif untuk siswa Magang PKL (hanya aktif pada hari Jumat, kecuali jika preview=true)
 * @param {object} dbClient - Database client/pool
 * @param {string} todayDateStr - Tanggal hari ini (YYYY-MM-DD)
 * @param {boolean} previewMode - Mode preview untuk pengujian admin/mentor
 * @returns {Promise<object|null>} Data notice lengkap beserta recipient
 */
async function getStudentNotice(dbClient, todayDateStr, previewMode = false) {
  // Hitung cohort active week (minggu berjalan cohort)
  let cohortActiveWeek = 1;
  try {
    const [minStartRes] = await dbClient.query(
      "SELECT MIN(start_date) as min_start FROM pkl_students WHERE status = 'ACTIVE'"
    );
    const baselineStart = minStartRes[0]?.min_start || todayDateStr;
    const baselineStartStr = new Date(baselineStart).toISOString().split('T')[0];
    const cohortProgress = studentService.calculatePklProgress(baselineStartStr, 4, todayDateStr);
    cohortActiveWeek = cohortProgress.active_week;
  } catch (err) {
    console.warn('[NoticeService] Gagal menghitung cohortActiveWeek:', err.message);
  }

  return await getNoticeDetailsForWeek(dbClient, cohortActiveWeek);
}

/**
 * Mengambil detail notice untuk pekan tertentu beserta penerimanya dari scoreboard
 * @param {object} dbClient 
 * @param {number} weekNumber 
 * @returns {Promise<object|null>}
 */
async function getNoticeDetailsForWeek(dbClient, weekNumber) {
  const notice = await noticeRepo.findByWeekNumber(dbClient, weekNumber);
  if (!notice || notice.is_active === 0 || notice.is_active === false) {
    return null;
  }

  // Ambil data klasemen/scoreboard pekan berjalan untuk mencari Rank 1 dan Rank Terakhir
  let winner = null;
  let loser = null;

  // Jaka's auto-show / manual logic:
  // 1. Dapatkan hari & jam saat ini di WIB (UTC+7)
  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const dayOfWeek = nowWib.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const hours = nowWib.getUTCHours();

  const isFridayAfternoon = dayOfWeek === 5 && hours >= 15;
  const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
  const inShowcaseWindow = isFridayAfternoon || isWeekend;

  const autoShow = notice.auto_show_recipients === 1 || notice.auto_show_recipients === true;
  const manualShow = notice.show_recipients === 1 || notice.show_recipients === true;

  const showRecipients = manualShow || (autoShow && inShowcaseWindow);

  if (showRecipients) {
    try {
      const students = await studentRepo.findAll(dbClient);
      const rankings = await scoreboardService.getScoreboard(dbClient, { role: 'admin' }, weekNumber);
      
      if (rankings && rankings.rankings && rankings.rankings.length > 0) {
        const list = rankings.rankings;
        winner = list[0]; // Rank 1
        loser = list[list.length - 1]; // Rank terakhir
      }
    } catch (err) {
      console.error('[NoticeService] Gagal memuat data klasemen untuk notice:', err);
    }
  }

  return {
    id: notice.id,
    week_number: notice.week_number,
    is_active: notice.is_active === 1 || notice.is_active === true,
    show_recipients: showRecipients,
    auto_show_recipients: autoShow,
    reward: {
      title: notice.reward_title,
      description: notice.reward_description,
      prize_name: notice.prize_name,
      prize_image_url: notice.prize_image_url,
      show_congrats: notice.show_congrats === 1 || notice.show_congrats === true,
      recipient: winner ? {
        name: winner.student_name,
        points: winner.total_points,
        profile_photo: winner.profile_photo || winner.student_avatar || null,
        school_name: winner.school_name
      } : null
    },
    punishment: {
      title: notice.punishment_title,
      description: notice.punishment_description,
      consequence: notice.consequence,
      consequence_image_url: notice.consequence_image_url,
      recipient: loser ? {
        name: loser.student_name,
        points: loser.total_points,
        profile_photo: loser.profile_photo || loser.student_avatar || null,
        school_name: loser.school_name
      } : null
    }
  };
}

/**
 * Mendapatkan daftar seluruh notice untuk admin panel
 * @param {object} dbClient 
 */
async function adminGetAllNotices(dbClient) {
  const notices = await noticeRepo.findAll(dbClient);
  
  // Dapatkan detail recipient untuk masing-masing notice agar admin bisa memantau
  const detailedNotices = [];
  for (const notice of notices) {
    let winner = null;
    let loser = null;
    try {
      const rankings = await scoreboardService.getScoreboard(dbClient, { role: 'admin' }, notice.week_number);
      if (rankings && rankings.rankings && rankings.rankings.length > 0) {
        winner = rankings.rankings[0];
        loser = rankings.rankings[rankings.rankings.length - 1];
      }
    } catch (e) {
      // Abaikan jika gagal memuat ranking
    }

    detailedNotices.push({
      ...notice,
      show_congrats: notice.show_congrats === 1 || notice.show_congrats === true,
      show_recipients: notice.show_recipients === 1 || notice.show_recipients === true,
      auto_show_recipients: notice.auto_show_recipients === 1 || notice.auto_show_recipients === true,
      is_active: notice.is_active === 1 || notice.is_active === true,
      winner: winner ? { name: winner.student_name, points: winner.total_points } : null,
      loser: loser ? { name: loser.student_name, points: loser.total_points } : null
    });
  }

  return detailedNotices;
}

/**
 * Menyimpan atau memperbarui data notice dari admin
 * @param {object} dbClient 
 * @param {object} data 
 */
async function adminSaveNotice(dbClient, data) {
  if (!data.week_number) {
    throw new Error('Nomor minggu cohort wajib disertakan');
  }
  return await noticeRepo.upsert(dbClient, data);
}

/**
 * Menghapus notice berdasarkan ID
 * @param {object} dbClient 
 * @param {number} id 
 */
async function adminDeleteNotice(dbClient, id) {
  return await noticeRepo.deleteNotice(dbClient, id);
}

module.exports = {
  getStudentNotice,
  getNoticeDetailsForWeek,
  adminGetAllNotices,
  adminSaveNotice,
  adminDeleteNotice
};
