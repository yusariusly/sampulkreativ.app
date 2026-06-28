/**
 * @module MentorSessionService
 * @description Business logic for mentor daily session locks and validation of daily evaluation completeness.
 */

const studentRepo = require('../repositories/student.repository');
const mentorSessionRepo = require('../repositories/mentor-session.repository');

/**
 * Mengunci dan mengirim seluruh sesi evaluasi harian mentor pada tanggal tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {string} sessionDate - Tanggal sesi evaluasi (YYYY-MM-DD)
 * @throws {Error} Jika ada siswa bimbingan yang belum diinput poinnya pada tanggal tersebut
 * @returns {Promise<boolean>} True jika sesi berhasil dikunci/dikirim
 */
async function submitDailySession(dbClient, mentorId, sessionDate) {
  // 1. Ambil daftar seluruh siswa bimbingan mentor
  const students = await studentRepo.findByMentorId(dbClient, mentorId);
  if (students.length === 0) {
    const err = new Error('Tidak ada siswa bimbingan untuk dievaluasi');
    err.code = 'INVALID_INPUT';
    throw err;
  }

  // 2. Ambil seluruh data evaluasi harian yang sudah diisi untuk siswa mentor tersebut pada tanggal terkait (Mencegah N+1)
  const [evalRows] = await dbClient.query(`
    SELECT student_id FROM pkl_daily_evaluations
    WHERE evaluation_date = ? AND student_id IN (
      SELECT id FROM pkl_students WHERE mentor_id = ?
    )
  `, [sessionDate, mentorId]);

  const completedStudentIds = new Set(evalRows.map(row => row.student_id));

  // 3. Validasi: Semua siswa bimbingan wajib memiliki entri evaluasi harian (idempotensi menjamin minimal terisi 0 poin)
  const missingStudents = students.filter(student => !completedStudentIds.has(student.student_id));
  if (missingStudents.length > 0) {
    const names = missingStudents.map(s => s.student_name).join(', ');
    const err = new Error(`Gagal mengirim sesi. Siswa berikut belum diinput poin hariannya: ${names}`);
    err.code = 'INVALID_INPUT';
    throw err;
  }

  // 4. Kunci sesi evaluasi harian mentor pada tanggal tersebut
  const sessionPayload = {
    mentor_id: mentorId,
    session_date: sessionDate,
    is_submitted: 1
  };

  const success = await mentorSessionRepo.upsert(dbClient, sessionPayload);
  return success;
}

module.exports = {
  submitDailySession
};
