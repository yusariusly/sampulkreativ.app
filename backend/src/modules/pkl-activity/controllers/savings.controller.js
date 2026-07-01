/**
 * @module SavingsController
 * @description Controller handling HTTP requests for the PKL Savings domain (Tabungan Buku).
 */

const savingsService = require('../services/savings.service');

/**
 * Mengambil progres tabungan untuk siswa yang sedang login
 * GET /api/v1/siswa/savings
 */
async function getStudentSavings(req, res, next) {
  try {
    const dbClient = req.app.pool;
    const userId = req.user.id;

    const savings = await savingsService.getStudentSavings(dbClient, userId);

    res.status(200).json({
      status: 'success',
      data: savings
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mengambil daftar tabungan seluruh siswa aktif (untuk Admin Panel)
 * GET /api/v1/pkl/savings
 */
async function adminGetSavings(req, res, next) {
  try {
    const dbClient = req.app.pool;
    const savings = await savingsService.adminGetAllSavings(dbClient);

    res.status(200).json({
      status: 'success',
      data: savings
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Memperbarui nominal tabungan siswa (untuk Admin Panel)
 * PUT /api/v1/pkl/savings/:studentId
 */
async function adminUpdateSavings(req, res, next) {
  try {
    const dbClient = req.app.pool;
    const { studentId } = req.params;
    const { saved_amount, target_amount } = req.body;

    if (saved_amount === undefined || saved_amount === null) {
      return res.status(400).json({ error: 'Nominal tabungan (saved_amount) wajib disertakan' });
    }
    if (target_amount === undefined || target_amount === null) {
      return res.status(400).json({ error: 'Target tabungan (target_amount) wajib disertakan' });
    }

    const success = await savingsService.adminUpdateSavings(
      dbClient,
      studentId,
      parseInt(saved_amount),
      parseInt(target_amount)
    );

    res.status(200).json({
      status: 'success',
      data: { success }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStudentSavings,
  adminGetSavings,
  adminUpdateSavings
};
