/**
 * @module TaskService
 * @description Business logic for PKL task checklist and template assignments.
 */

const studentRepo = require('../repositories/student.repository');
const taskRepo = require('../repositories/task.repository');

/**
 * Mengubah status penyelesaian tugas mandiri oleh Siswa PKL (dengan verifikasi kepemilikan tugas)
 * @param {object} dbClient - Database client/pool
 * @param {string} userId - ID User siswa yang sedang login
 * @param {string} taskId - ID Tugas Program
 * @param {boolean} isCompletedBool - Status penyelesaian (true/false)
 * @throws {Error} Jika siswa tidak ditemukan atau tugas tidak terdaftar di template miliknya
 * @returns {Promise<boolean>} True jika status berhasil diubah
 */
async function toggleStudentTask(dbClient, userId, taskId, isCompletedBool) {
  // 1. Cari siswa terkait
  const student = await studentRepo.findByUserId(dbClient, userId);
  if (!student) {
    const err = new Error('Siswa tidak terdaftar');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const studentId = student.student_id;

  // 2. Ambil seluruh daftar tugas program siswa untuk validasi kepemilikan task
  const studentTasks = await taskRepo.findTasksByStudentId(dbClient, studentId);
  const taskExists = studentTasks.some(t => t.task_id === taskId);
  
  if (!taskExists) {
    const err = new Error('Tugas tidak terdaftar pada program kerja Anda');
    err.code = 'FORBIDDEN';
    throw err;
  }

  // 3. Konversi boolean ke TINYINT 0 atau 1
  const isCompletedVal = isCompletedBool ? 1 : 0;

  // 4. Lakukan penyimpanan status ke database
  const success = await taskRepo.updateStudentTaskStatus(dbClient, studentId, taskId, isCompletedVal);
  return success;
}

module.exports = {
  toggleStudentTask
};
