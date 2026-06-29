/**
 * @module DailyEvaluationRepository
 * @description Database operations for the pkl_daily_evaluations table.
 */

/**
 * Mendapatkan data evaluasi harian siswa untuk tanggal tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {string} evaluationDate - Tanggal evaluasi (YYYY-MM-DD)
 * @returns {Promise<object|null>} Data evaluasi harian
 */
async function findByStudentAndDate(dbClient, studentId, evaluationDate) {
  const query = `
    SELECT id, student_id, evaluation_date, wkt_point, skp_point, has_point, ker_point, ini_point, created_at
    FROM pkl_daily_evaluations
    WHERE student_id = ? AND evaluation_date = ?
  `;
  const [rows] = await dbClient.query(query, [studentId, evaluationDate]);
  return rows[0] || null;
}

/**
 * Mendapatkan daftar evaluasi harian siswa dalam rentang tanggal tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {string} startDate - Tanggal awal rentang (YYYY-MM-DD)
 * @param {string} endDate - Tanggal akhir rentang (YYYY-MM-DD)
 * @returns {Promise<Array<object>>} Daftar evaluasi harian
 */
async function findByStudentAndDateRange(dbClient, studentId, startDate, endDate) {
  const query = `
    SELECT id, student_id, evaluation_date, wkt_point, skp_point, has_point, ker_point, ini_point, created_at
    FROM pkl_daily_evaluations
    WHERE student_id = ? AND evaluation_date BETWEEN ? AND ?
    ORDER BY evaluation_date ASC
  `;
  const [rows] = await dbClient.query(query, [studentId, startDate, endDate]);
  return rows;
}

/**
 * Menyimpan atau memperbarui data evaluasi poin harian siswa (Idempotent Upsert)
 * @param {object} dbClient - Database client/pool
 * @param {object} evalData - Data evaluasi harian
 * @param {string} evalData.student_id - ID Siswa PKL
 * @param {string} evalData.evaluation_date - Tanggal evaluasi (YYYY-MM-DD)
 * @param {number} evalData.wkt_point - Poin kedisiplinan waktu (0 atau 1)
 * @param {number} evalData.skp_point - Poin sikap kerja (0 atau 1)
 * @param {number} evalData.has_point - Poin hasil kerja (0 atau 1)
 * @param {number} evalData.ker_point - Poin kerja sama (0 atau 1)
 * @param {number} evalData.ini_point - Poin inisiatif (0 atau 1)
 * @returns {Promise<boolean>} True jika penyimpanan/pembaruan berhasil
 */
async function upsert(dbClient, evalData) {
  const checkQuery = 'SELECT id FROM pkl_daily_evaluations WHERE student_id = ? AND evaluation_date = ?';
  const [rows] = await dbClient.query(checkQuery, [evalData.student_id, evalData.evaluation_date]);

  if (rows.length > 0) {
    const updateQuery = `
      UPDATE pkl_daily_evaluations 
      SET wkt_point = ?, skp_point = ?, has_point = ?, ker_point = ?, ini_point = ? 
      WHERE id = ?
    `;
    const [result] = await dbClient.query(updateQuery, [
      evalData.wkt_point,
      evalData.skp_point,
      evalData.has_point,
      evalData.ker_point,
      evalData.ini_point,
      rows[0].id
    ]);
    return result.affectedRows > 0;
  } else {
    const insertQuery = `
      INSERT INTO pkl_daily_evaluations (id, student_id, evaluation_date, wkt_point, skp_point, has_point, ker_point, ini_point, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const newId = `ev-${evalData.student_id}-${evalData.evaluation_date}`;
    const [result] = await dbClient.query(insertQuery, [
      newId,
      evalData.student_id,
      evalData.evaluation_date,
      evalData.wkt_point,
      evalData.skp_point,
      evalData.has_point,
      evalData.ker_point,
      evalData.ini_point
    ]);
    return result.affectedRows > 0;
  }
}

/**
 * Mendapatkan rekapitulasi jumlah poin per aspek dalam rentang tanggal tertentu (untuk rekap mingguan)
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {string} startDate - Tanggal awal rentang (YYYY-MM-DD)
 * @param {string} endDate - Tanggal akhir rentang (YYYY-MM-DD)
 * @returns {Promise<object>} Summary poin per aspek
 */
async function getPointSummaryByWeek(dbClient, studentId, startDate, endDate) {
  const query = `
    SELECT 
      COUNT(*) as days_count,
      COALESCE(SUM(wkt_point), 0) as wkt_total,
      COALESCE(SUM(skp_point), 0) as skp_total,
      COALESCE(SUM(has_point), 0) as has_total,
      COALESCE(SUM(ker_point), 0) as ker_total,
      COALESCE(SUM(ini_point), 0) as ini_total
    FROM pkl_daily_evaluations
    WHERE student_id = ? AND evaluation_date BETWEEN ? AND ?
  `;
  const [rows] = await dbClient.query(query, [studentId, startDate, endDate]);
  
  // Memastikan tipe data kembalian adalah number
  const summary = rows[0];
  return {
    days_count: Number(summary.days_count),
    wkt_total: Number(summary.wkt_total),
    skp_total: Number(summary.skp_total),
    has_total: Number(summary.has_total),
    ker_total: Number(summary.ker_total),
    ini_total: Number(summary.ini_total)
  };
}

/**
 * Mendapatkan total kalkulasi seluruh aspek poin untuk semua siswa bimbingan mentor dalam rentang tanggal tertentu (mencegah N+1)
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor pembimbing
 * @param {string} startDate - Tanggal awal rentang (YYYY-MM-DD)
 * @param {string} endDate - Tanggal akhir rentang (YYYY-MM-DD)
 * @returns {Promise<Array<object>>} List objek dengan student_id dan calculated_total_points
 */
async function getPointsSummaryForMentorStudents(dbClient, mentorId, startDate, endDate) {
  const query = `
    SELECT 
      s.id as student_id,
      COALESCE(SUM(e.wkt_point), 0) + 
      COALESCE(SUM(e.skp_point), 0) + 
      COALESCE(SUM(e.has_point), 0) + 
      COALESCE(SUM(e.ker_point), 0) + 
      COALESCE(SUM(e.ini_point), 0) as calculated_total_points
    FROM pkl_students s
    LEFT JOIN pkl_daily_evaluations e ON s.id = e.student_id AND e.evaluation_date BETWEEN ? AND ?
    GROUP BY s.id
  `;
  const [rows] = await dbClient.query(query, [startDate, endDate]);
  return rows;
}

module.exports = {
  findByStudentAndDate,
  findByStudentAndDateRange,
  upsert,
  getPointSummaryByWeek,
  getPointsSummaryForMentorStudents
};
