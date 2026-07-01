/**
 * @module SavingsService
 * @description Business logic for PKL Savings (Tabungan Buku).
 */

const savingsRepo = require('../repositories/savings.repository');
const studentRepo = require('../repositories/student.repository');

/**
 * Mengambil data tabungan untuk siswa berdasarkan user_id (dari sesi login)
 * @param {object} dbClient - Database client/pool
 * @param {string} userId - User ID dari sesi login
 * @returns {Promise<object>} Data tabungan siswa
 */
async function getStudentSavings(dbClient, userId) {
  const student = await studentRepo.findByUserId(dbClient, userId);
  if (!student) {
    const err = new Error('Siswa tidak terdaftar');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const savings = await savingsRepo.findByStudentId(dbClient, student.student_id);
  return {
    student_id: savings.student_id,
    saved_amount: savings.saved_amount,
    target_amount: savings.target_amount,
    updated_at: savings.updated_at
  };
}

/**
 * Mengambil data tabungan seluruh siswa aktif (untuk Admin Panel)
 * @param {object} dbClient - Database client/pool
 * @returns {Promise<Array<object>>} Daftar tabungan seluruh siswa aktif
 */
async function adminGetAllSavings(dbClient) {
  return savingsRepo.findAll(dbClient);
}

/**
 * Memperbarui nominal tabungan siswa (untuk Admin Panel)
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {number} savedAmount - Nominal tabungan baru
 * @param {number} targetAmount - Target nominal tabungan
 * @returns {Promise<boolean>} True jika berhasil
 */
async function adminUpdateSavings(dbClient, studentId, savedAmount, targetAmount) {
  // Validasi student_id terdaftar sebagai siswa aktif
  const student = await studentRepo.findById(dbClient, studentId);
  if (!student) {
    const err = new Error('Siswa tidak ditemukan atau tidak aktif');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Validasi nominal
  if (typeof savedAmount !== 'number' || savedAmount < 0) {
    const err = new Error('Nominal tabungan tidak valid');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (typeof targetAmount !== 'number' || targetAmount <= 0) {
    const err = new Error('Target tabungan harus lebih dari 0');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  return savingsRepo.upsert(dbClient, studentId, savedAmount, targetAmount);
}

module.exports = {
  getStudentSavings,
  adminGetAllSavings,
  adminUpdateSavings
};
