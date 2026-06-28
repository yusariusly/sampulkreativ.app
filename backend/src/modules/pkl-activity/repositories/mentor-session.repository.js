/**
 * @module MentorSessionRepository
 * @description Database operations for the pkl_mentor_daily_sessions table.
 */

/**
 * Mendapatkan status submit sesi evaluasi harian mentor pada tanggal tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor (User ID pembimbing)
 * @param {string} sessionDate - Tanggal sesi evaluasi (YYYY-MM-DD)
 * @returns {Promise<object|null>} Data status submit sesi harian
 */
async function findByMentorAndDate(dbClient, mentorId, sessionDate) {
  const query = `
    SELECT id, mentor_id, session_date, is_submitted, created_at
    FROM pkl_mentor_daily_sessions
    WHERE mentor_id = ? AND session_date = ?
  `;
  const [rows] = await dbClient.query(query, [mentorId, sessionDate]);
  return rows[0] || null;
}

/**
 * Menyimpan atau memperbarui status submit sesi evaluasi harian mentor (Idempotent Upsert)
 * @param {object} dbClient - Database client/pool
 * @param {object} sessionData - Data sesi harian mentor
 * @param {string} sessionData.mentor_id - ID Mentor pembimbing
 * @param {string} sessionData.session_date - Tanggal sesi evaluasi (YYYY-MM-DD)
 * @param {number} sessionData.is_submitted - Status submit harian (0: belum, 1: sudah dikirim)
 * @returns {Promise<boolean>} True jika penyimpanan/pembaruan berhasil
 */
async function upsert(dbClient, sessionData) {
  const checkQuery = 'SELECT id FROM pkl_mentor_daily_sessions WHERE mentor_id = ? AND session_date = ?';
  const [rows] = await dbClient.query(checkQuery, [sessionData.mentor_id, sessionData.session_date]);

  if (rows.length > 0) {
    const updateQuery = 'UPDATE pkl_mentor_daily_sessions SET is_submitted = ? WHERE id = ?';
    const [result] = await dbClient.query(updateQuery, [sessionData.is_submitted, rows[0].id]);
    return result.affectedRows > 0;
  } else {
    const insertQuery = `
      INSERT INTO pkl_mentor_daily_sessions (id, mentor_id, session_date, is_submitted, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    const newId = `ms-${sessionData.mentor_id}-${sessionData.session_date}`;
    const [result] = await dbClient.query(insertQuery, [
      newId,
      sessionData.mentor_id,
      sessionData.session_date,
      sessionData.is_submitted
    ]);
    return result.affectedRows > 0;
  }
}

module.exports = {
  findByMentorAndDate,
  upsert
};
