/**
 * @module NoticeController
 * @description Controller handling incoming HTTP requests for the PKL Notice domain (Reward & Punishment).
 */

const noticeService = require('../services/notice.service');

/**
 * Mengambil notice aktif untuk siswa (hanya hari Jumat, atau mode preview)
 * GET /api/v1/siswa/notice
 */
async function getStudentNotice(req, res, next) {
  try {
    const dbClient = req.app.pool;
    // Default menggunakan tanggal hari ini (GMT+7)
    const todayStr = req.query.date || new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    const previewMode = req.query.preview === 'true';

    const noticeData = await noticeService.getStudentNotice(dbClient, todayStr, previewMode);

    res.status(200).json({
      status: 'success',
      data: noticeData
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mengambil daftar seluruh notice (untuk Admin Panel)
 * GET /api/v1/pkl/notices
 */
async function adminGetNotices(req, res, next) {
  try {
    const dbClient = req.app.pool;
    const notices = await noticeService.adminGetAllNotices(dbClient);

    res.status(200).json({
      status: 'success',
      data: notices
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Membuat atau memperbarui notice (untuk Admin Panel)
 * POST /api/v1/pkl/notices
 */
async function adminSaveNotice(req, res, next) {
  try {
    const dbClient = req.app.pool;
    const body = req.body;

    // Validasi basic
    if (!body.week_number) {
      return res.status(400).json({ error: 'Pekan cohort (week_number) wajib disertakan' });
    }
    if (!body.prize_name) {
      return res.status(400).json({ error: 'Hadiah (prize_name) wajib diisi' });
    }
    if (!body.consequence) {
      return res.status(400).json({ error: 'Konsekuensi (consequence) wajib diisi' });
    }

    const success = await noticeService.adminSaveNotice(dbClient, {
      week_number: parseInt(body.week_number),
      reward_title: body.reward_title || 'Top Performer',
      reward_description: body.reward_description || 'Apresiasi atas kinerja terbaik pekan ini',
      prize_name: body.prize_name,
      prize_image_url: body.prize_image_url || null,
      show_congrats: body.show_congrats === true || body.show_congrats === 1,
      show_recipients: body.show_recipients === undefined ? true : (body.show_recipients === true || body.show_recipients === 1),
      auto_show_recipients: body.auto_show_recipients === undefined ? true : (body.auto_show_recipients === true || body.auto_show_recipients === 1),
      punishment_title: body.punishment_title || 'Perlu Evaluasi',
      punishment_description: body.punishment_description || 'Evaluasi atas kinerja pekan ini',
      consequence: body.consequence,
      consequence_image_url: body.consequence_image_url || null,
      is_active: body.is_active === undefined ? true : (body.is_active === true || body.is_active === 1)
    });

    res.status(200).json({
      status: 'success',
      data: { success }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Menghapus notice (untuk Admin Panel)
 * DELETE /api/v1/pkl/notices/:id
 */
async function adminDeleteNotice(req, res, next) {
  try {
    const dbClient = req.app.pool;
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID tidak valid' });
    }

    const success = await noticeService.adminDeleteNotice(dbClient, id);

    res.status(200).json({
      status: 'success',
      data: { success }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStudentNotice,
  adminGetNotices,
  adminSaveNotice,
  adminDeleteNotice
};
