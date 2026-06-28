/**
 * @module StudentRepository
 * @description Database operations for the pkl_students table.
 */

/**
 * Mendapatkan profil siswa PKL berdasarkan ID Siswa (student_id)
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @returns {Promise<object|null>} Data siswa beserta nama lengkap, foto, dan nama mentor
 */
async function findById(dbClient, studentId) {
  const query = `
    SELECT 
      s.id as student_id,
      s.user_id,
      s.mentor_id,
      s.program_template_id,
      s.school_name,
      s.start_date,
      s.end_date,
      u.nama_lengkap as student_name,
      u.foto_profile as student_avatar,
      m.nama_lengkap as mentor_name,
      t.title as program_title
    FROM pkl_students s
    JOIN users u ON s.user_id = u.id
    JOIN users m ON s.mentor_id = m.id
    JOIN pkl_program_templates t ON s.program_template_id = t.id
    WHERE s.id = ?
  `;
  const [rows] = await dbClient.query(query, [studentId]);
  return rows[0] || null;
}

/**
 * Mendapatkan profil siswa PKL berdasarkan User ID (user_id di tabel users)
 * @param {object} dbClient - Database client/pool
 * @param {string} userId - ID Pengguna (User ID)
 * @returns {Promise<object|null>} Data siswa beserta nama lengkap dan detail template program
 */
async function findByUserId(dbClient, userId) {
  const query = `
    SELECT 
      s.id as student_id,
      s.user_id,
      s.mentor_id,
      s.program_template_id,
      s.school_name,
      s.start_date,
      s.end_date,
      u.nama_lengkap as student_name,
      u.foto_profile as student_avatar,
      m.nama_lengkap as mentor_name,
      t.title as program_title
    FROM pkl_students s
    JOIN users u ON s.user_id = u.id
    JOIN users m ON s.mentor_id = m.id
    JOIN pkl_program_templates t ON s.program_template_id = t.id
    WHERE s.user_id = ?
  `;
  const [rows] = await dbClient.query(query, [userId]);
  return rows[0] || null;
}

/**
 * Mendapatkan daftar seluruh siswa PKL yang dibimbing oleh mentor tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor (User ID pembimbing)
 * @returns {Promise<Array<object>>} Daftar siswa bimbingan
 */
async function findByMentorId(dbClient, mentorId) {
  const query = `
    SELECT 
      s.id as student_id,
      s.user_id,
      s.mentor_id,
      s.program_template_id,
      s.school_name,
      s.start_date,
      s.end_date,
      u.nama_lengkap as student_name,
      u.foto_profile as student_avatar,
      t.title as program_title
    FROM pkl_students s
    JOIN users u ON s.user_id = u.id
    JOIN pkl_program_templates t ON s.program_template_id = t.id
    WHERE s.mentor_id = ?
    ORDER BY u.nama_lengkap ASC
  `;
  const [rows] = await dbClient.query(query, [mentorId]);
  return rows;
}

/**
 * Mendapatkan seluruh daftar siswa PKL di sistem
 * @param {object} dbClient - Database client/pool
 * @returns {Promise<Array<object>>} Daftar seluruh siswa
 */
async function findAll(dbClient) {
  const query = `
    SELECT 
      s.id as student_id,
      s.user_id,
      s.mentor_id,
      s.program_template_id,
      s.school_name,
      s.start_date,
      s.end_date,
      u.nama_lengkap as student_name,
      m.nama_lengkap as mentor_name,
      t.title as program_title
    FROM pkl_students s
    JOIN users u ON s.user_id = u.id
    JOIN users m ON s.mentor_id = m.id
    JOIN pkl_program_templates t ON s.program_template_id = t.id
    ORDER BY u.nama_lengkap ASC
  `;
  const [rows] = await dbClient.query(query);
  return rows;
}

/**
 * Membuat data profil siswa PKL baru
 * @param {object} dbClient - Database client/pool
 * @param {object} studentData - Data siswa baru
 * @param {string} studentData.id - ID Siswa PKL (misal: std-xxx)
 * @param {string} studentData.user_id - ID User terkait
 * @param {string} studentData.mentor_id - ID Mentor pembimbing
 * @param {string} studentData.program_template_id - ID Template Program
 * @param {string} studentData.school_name - Nama Sekolah/Instansi
 * @param {string} studentData.start_date - Tanggal Mulai Magang (YYYY-MM-DD)
 * @param {string} studentData.end_date - Tanggal Selesai Magang (YYYY-MM-DD)
 * @returns {Promise<void>}
 */
async function create(dbClient, studentData) {
  const query = `
    INSERT INTO pkl_students (id, user_id, mentor_id, program_template_id, school_name, start_date, end_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;
  await dbClient.query(query, [
    studentData.id,
    studentData.user_id,
    studentData.mentor_id,
    studentData.program_template_id,
    studentData.school_name,
    studentData.start_date,
    studentData.end_date
  ]);
}

/**
 * Memperbarui profil siswa PKL
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {object} updateData - Data yang akan diperbarui
 * @param {string} [updateData.mentor_id] - ID Mentor pembimbing baru
 * @param {string} [updateData.program_template_id] - ID Template Program baru
 * @param {string} [updateData.school_name] - Nama sekolah baru
 * @param {string} [updateData.start_date] - Tanggal mulai baru
 * @param {string} [updateData.end_date] - Tanggal selesai baru
 * @returns {Promise<boolean>} True jika data berhasil diperbarui
 */
async function update(dbClient, studentId, updateData) {
  const fields = [];
  const params = [];

  if (updateData.mentor_id !== undefined) {
    fields.push('mentor_id = ?');
    params.push(updateData.mentor_id);
  }
  if (updateData.program_template_id !== undefined) {
    fields.push('program_template_id = ?');
    params.push(updateData.program_template_id);
  }
  if (updateData.school_name !== undefined) {
    fields.push('school_name = ?');
    params.push(updateData.school_name);
  }
  if (updateData.start_date !== undefined) {
    fields.push('start_date = ?');
    params.push(updateData.start_date);
  }
  if (updateData.end_date !== undefined) {
    fields.push('end_date = ?');
    params.push(updateData.end_date);
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = NOW()');
  params.push(studentId);

  const query = `
    UPDATE pkl_students 
    SET ${fields.join(', ')} 
    WHERE id = ?
  `;

  const [result] = await dbClient.query(query, params);
  return result.affectedRows > 0;
}

/**
 * Mendapatkan seluruh siswa bimbingan mentor beserta poin evaluasi harian mereka pada tanggal tertentu
 * @param {object} dbClient - Database client/pool
 * @param {string} mentorId - ID Mentor (User ID pembimbing)
 * @param {string} date - Tanggal evaluasi (YYYY-MM-DD)
 * @returns {Promise<Array<object>>} Daftar siswa bimbingan beserta evaluasi harian
 */
async function findStudentsWithDailyEvaluation(dbClient, mentorId, date) {
  const query = `
    SELECT 
      s.id as student_id,
      s.user_id,
      s.mentor_id,
      s.program_template_id,
      s.school_name,
      s.start_date,
      s.end_date,
      u.nama_lengkap as student_name,
      u.foto_profile as student_avatar,
      t.title as program_title,
      e.wkt_point,
      e.skp_point,
      e.has_point,
      e.ker_point,
      e.ini_point
    FROM pkl_students s
    JOIN users u ON s.user_id = u.id
    JOIN pkl_program_templates t ON s.program_template_id = t.id
    LEFT JOIN pkl_daily_evaluations e ON s.id = e.student_id AND e.evaluation_date = ?
    WHERE s.mentor_id = ?
    ORDER BY u.nama_lengkap ASC
  `;
  const [rows] = await dbClient.query(query, [date, mentorId]);
  return rows;
}

module.exports = {
  findById,
  findByUserId,
  findByMentorId,
  findAll,
  create,
  update,
  findStudentsWithDailyEvaluation
};
