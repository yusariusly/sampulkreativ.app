/**
 * @module SavingsRepository
 * @description Database operations for the pkl_savings table.
 */

/**
 * Mendapatkan data tabungan berdasarkan student_id
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @returns {Promise<object>} Data tabungan (default jika belum ada baris)
 */
async function findByStudentId(dbClient, studentId) {
  const query = `
    SELECT student_id, saved_amount, target_amount, updated_at
    FROM pkl_savings
    WHERE student_id = ?
  `;
  const [rows] = await dbClient.query(query, [studentId]);
  if (rows[0]) return rows[0];

  // Return default jika belum ada baris data
  return {
    student_id: studentId,
    saved_amount: 0,
    target_amount: 70000,
    updated_at: null
  };
}

/**
 * Mendapatkan data tabungan seluruh siswa aktif (left join)
 * @param {object} dbClient - Database client/pool
 * @returns {Promise<Array<object>>} Daftar tabungan seluruh siswa aktif
 */
async function findAll(dbClient) {
  const query = `
    SELECT 
      s.id AS student_id,
      u.nama_lengkap AS student_name,
      s.school_name,
      COALESCE(sa.saved_amount, 0) AS saved_amount,
      COALESCE(sa.target_amount, 70000) AS target_amount,
      sa.updated_at
    FROM pkl_students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN pkl_savings sa ON s.id = sa.student_id
    WHERE s.status = 'ACTIVE' AND u.role = 'student'
    ORDER BY u.nama_lengkap ASC
  `;
  const [rows] = await dbClient.query(query);
  return rows;
}

/**
 * Menyisipkan atau memperbarui data tabungan siswa (Upsert)
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {number} savedAmount - Nominal tabungan saat ini
 * @param {number} targetAmount - Target nominal tabungan
 * @returns {Promise<boolean>} True jika berhasil
 */
async function upsert(dbClient, studentId, savedAmount, targetAmount) {
  const checkQuery = 'SELECT student_id FROM pkl_savings WHERE student_id = ?';
  const [rows] = await dbClient.query(checkQuery, [studentId]);

  if (rows.length > 0) {
    const updateQuery = `
      UPDATE pkl_savings
      SET saved_amount = ?, target_amount = ?, updated_at = NOW()
      WHERE student_id = ?
    `;
    const [result] = await dbClient.query(updateQuery, [savedAmount, targetAmount, studentId]);
    return result.affectedRows > 0;
  } else {
    const insertQuery = `
      INSERT INTO pkl_savings (student_id, saved_amount, target_amount, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `;
    const [result] = await dbClient.query(insertQuery, [studentId, savedAmount, targetAmount]);
    return result.affectedRows > 0;
  }
}

module.exports = {
  findByStudentId,
  findAll,
  upsert
};
