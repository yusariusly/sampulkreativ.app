/**
 * @module WeeklySummaryRepository
 * @description Database operations for the pkl_weekly_summaries table.
 */

/**
 * Mendapatkan rekap mingguan berdasarkan ID Siswa dan nomor minggu
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {number} weekNumber - Nomor Minggu
 * @returns {Promise<object|null>} Data rekap mingguan
 */
async function findByStudentAndWeek(dbClient, studentId, weekNumber) {
  const query = `
    SELECT id, student_id, week_number, total_points, comments, tags, is_published, created_at, updated_at
    FROM pkl_weekly_summaries
    WHERE student_id = ? AND week_number = ?
  `;
  const [rows] = await dbClient.query(query, [studentId, weekNumber]);
  return rows[0] || null;
}

/**
 * Mendapatkan seluruh riwayat rekap mingguan siswa (baik yang sudah dirilis maupun draf)
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @returns {Promise<Array<object>>} Daftar rekap mingguan terurut dari minggu terbaru
 */
async function findByStudent(dbClient, studentId) {
  const query = `
    SELECT id, student_id, week_number, total_points, comments, tags, is_published, created_at, updated_at
    FROM pkl_weekly_summaries
    WHERE student_id = ?
    ORDER BY week_number DESC
  `;
  const [rows] = await dbClient.query(query, [studentId]);
  return rows;
}

/**
 * Mendapatkan riwayat rekap mingguan siswa yang sudah dipublikasikan (is_published = 1)
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @returns {Promise<Array<object>>} Daftar rekap mingguan yang terbit
 */
async function findPublishedByStudent(dbClient, studentId) {
  const query = `
    SELECT id, student_id, week_number, total_points, comments, tags, is_published, created_at, updated_at
    FROM pkl_weekly_summaries
    WHERE student_id = ? AND is_published = 1
    ORDER BY week_number DESC
  `;
  const [rows] = await dbClient.query(query, [studentId]);
  return rows;
}

/**
 * Menyimpan atau memperbarui rekap mingguan siswa (Idempotent Upsert)
 * @param {object} dbClient - Database client/pool
 * @param {object} summaryData - Data rekap mingguan
 * @param {string} summaryData.student_id - ID Siswa PKL
 * @param {number} summaryData.week_number - Nomor Minggu
 * @param {number} summaryData.total_points - Total akumulasi poin reward (0 s.d 25)
 * @param {string|null} summaryData.comments - Catatan evaluasi/umpan balik mentor
 * @param {string|null} summaryData.tags - Tag/Label kompetensi (JSON string, misal: ["Fokus", "Mandiri"])
 * @param {number} summaryData.is_published - Status rilis (0: draf, 1: terbit)
 * @returns {Promise<boolean>} True jika penyimpanan/pembaruan berhasil
 */
async function upsert(dbClient, summaryData) {
  const checkQuery = 'SELECT id FROM pkl_weekly_summaries WHERE student_id = ? AND week_number = ?';
  const [rows] = await dbClient.query(checkQuery, [summaryData.student_id, summaryData.week_number]);

  if (rows.length > 0) {
    const updateQuery = `
      UPDATE pkl_weekly_summaries 
      SET total_points = ?, comments = ?, tags = ?, is_published = ?, updated_at = NOW() 
      WHERE id = ?
    `;
    const [result] = await dbClient.query(updateQuery, [
      summaryData.total_points,
      summaryData.comments,
      summaryData.tags,
      summaryData.is_published,
      rows[0].id
    ]);
    return result.affectedRows > 0;
  } else {
    const insertQuery = `
      INSERT INTO pkl_weekly_summaries (id, student_id, week_number, total_points, comments, tags, is_published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const newId = `sum-${summaryData.student_id}-w${summaryData.week_number}`;
    const [result] = await dbClient.query(insertQuery, [
      newId,
      summaryData.student_id,
      summaryData.week_number,
      summaryData.total_points,
      summaryData.comments,
      summaryData.tags,
      summaryData.is_published
    ]);
    return result.affectedRows > 0;
  }
}

/**
 * Mempublikasikan rekap mingguan siswa (Mengubah is_published dari draf ke terbit)
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {number} weekNumber - Nomor Minggu
 * @returns {Promise<boolean>} True jika berhasil dirilis
 */
async function publish(dbClient, studentId, weekNumber) {
  const query = `
    UPDATE pkl_weekly_summaries 
    SET is_published = 1, updated_at = NOW() 
    WHERE student_id = ? AND week_number = ?
  `;
  const [result] = await dbClient.query(query, [studentId, weekNumber]);
  return result.affectedRows > 0;
}

/**
 * Mendapatkan daftar rekap mingguan seluruh siswa bimbingan mentor untuk minggu tertentu (mencegah N+1)
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {number} weekNumber - Nomor Minggu
 * @returns {Promise<Array<object>>} Daftar rekap mingguan
 */
async function findWeeklySummariesByMentor(dbClient, mentorId, weekNumber) {
  const query = `
    SELECT 
      s.id as student_id,
      u.nama_lengkap as student_name,
      s.school_name,
      ws.id as summary_id,
      ws.week_number,
      COALESCE(ws.total_points, 0) as total_points,
      ws.comments,
      ws.tags,
      COALESCE(ws.is_published, 0) as is_published
    FROM pkl_students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN pkl_weekly_summaries ws ON s.id = ws.student_id AND ws.week_number = ?
    WHERE s.status = 'ACTIVE' AND u.role = 'student'
    ORDER BY u.nama_lengkap ASC
  `;
  const [rows] = await dbClient.query(query, [weekNumber]);
  return rows;
}

/**
 * Mempublikasikan rekap mingguan untuk semua siswa di bawah bimbingan mentor tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {number} weekNumber - Nomor Minggu
 * @returns {Promise<boolean>} True jika proses berhasil
 */
async function publishAllByMentor(dbClient, mentorId, weekNumber) {
  const query = `
    UPDATE pkl_weekly_summaries 
    SET is_published = 1, updated_at = NOW() 
    WHERE week_number = ? AND student_id IN (
      SELECT id FROM pkl_students WHERE status = 'ACTIVE'
    )
  `;
  const [result] = await dbClient.query(query, [weekNumber]);
  return result.affectedRows > 0;
}

/**
 * Mendapatkan rekap mingguan terpublikasi terakhir untuk siswa tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @returns {Promise<object|null>} Rekap mingguan terbaru yang sudah dipublikasi
 */
async function findLatestPublished(dbClient, studentId) {
  const query = `
    SELECT * FROM pkl_weekly_summaries
    WHERE student_id = ? AND is_published = 1
    ORDER BY week_number DESC LIMIT 1
  `;
  const [rows] = await dbClient.query(query, [studentId]);
  return rows[0] || null;
}

/**
 * Membatalkan publikasi rekap mingguan untuk semua siswa di bawah bimbingan mentor tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {number} weekNumber - Nomor Minggu
 * @returns {Promise<boolean>} True jika proses berhasil
 */
async function unpublishAllByMentor(dbClient, mentorId, weekNumber) {
  const query = `
    UPDATE pkl_weekly_summaries 
    SET is_published = 0, updated_at = NOW() 
    WHERE week_number = ? AND student_id IN (
      SELECT id FROM pkl_students WHERE status = 'ACTIVE'
    )
  `;
  const [result] = await dbClient.query(query, [weekNumber]);
  return result.affectedRows > 0;
}

module.exports = {
  findByStudentAndWeek,
  findByStudent,
  findPublishedByStudent,
  upsert,
  publish,
  findWeeklySummariesByMentor,
  publishAllByMentor,
  unpublishAllByMentor,
  findLatestPublished
};
