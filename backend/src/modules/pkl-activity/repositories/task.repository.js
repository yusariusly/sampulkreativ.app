/**
 * @module TaskRepository
 * @description Database operations for pkl_program_templates, pkl_program_weeks, pkl_program_tasks, and pkl_student_tasks tables.
 */

/**
 * Mendapatkan daftar seluruh template program kerja PKL
 * @param {object} dbClient - Database client/pool
 * @returns {Promise<Array<object>>} Daftar template program
 */
async function findTemplates(dbClient) {
  const query = 'SELECT id, title, duration_months, created_at FROM pkl_program_templates ORDER BY created_at DESC';
  const [rows] = await dbClient.query(query);
  return rows;
}

/**
 * Mendapatkan daftar milestone mingguan berdasarkan Template ID
 * @param {object} dbClient - Database client/pool
 * @param {string} templateId - ID Template Program
 * @returns {Promise<Array<object>>} Daftar minggu program
 */
async function findWeeksByTemplateId(dbClient, templateId) {
  const query = `
    SELECT id, template_id, week_number, month_number, milestone_title, created_at 
    FROM pkl_program_weeks 
    WHERE template_id = ? 
    ORDER BY week_number ASC
  `;
  const [rows] = await dbClient.query(query, [templateId]);
  return rows;
}

/**
 * Mendapatkan daftar tugas berdasarkan Week ID
 * @param {object} dbClient - Database client/pool
 * @param {string} weekId - ID Minggu Program
 * @returns {Promise<Array<object>>} Daftar tugas mingguan
 */
async function findTasksByWeekId(dbClient, weekId) {
  const query = `
    SELECT id, week_id, task_title, is_mandatory, created_at 
    FROM pkl_program_tasks 
    WHERE week_id = ? 
    ORDER BY created_at ASC
  `;
  const [rows] = await dbClient.query(query, [weekId]);
  return rows;
}

/**
 * Mendapatkan semua tugas mingguan beserta status penyelesaian siswa PKL
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @returns {Promise<Array<object>>} Daftar tugas beserta status is_completed
 */
async function findTasksByStudentId(dbClient, studentId) {
  const query = `
    SELECT 
      t.id as task_id,
      t.week_id,
      t.task_title,
      t.is_mandatory,
      w.week_number,
      w.month_number,
      COALESCE(st.is_completed, 0) as is_completed,
      st.updated_at as completed_at
    FROM pkl_students s
    JOIN pkl_program_weeks w ON s.program_template_id = w.template_id
    JOIN pkl_program_tasks t ON w.id = t.week_id
    LEFT JOIN pkl_student_tasks st ON s.id = st.student_id AND t.id = st.task_id
    WHERE s.id = ?
    ORDER BY w.week_number ASC, t.created_at ASC
  `;
  const [rows] = await dbClient.query(query, [studentId]);
  return rows;
}

/**
 * Memperbarui atau membuat status penyelesaian tugas mandiri oleh siswa PKL
 * @param {object} dbClient - Database client/pool
 * @param {string} studentId - ID Siswa PKL
 * @param {string} taskId - ID Tugas Program
 * @param {number} isCompleted - Status penyelesaian (0 atau 1)
 * @returns {Promise<boolean>} True jika penyimpanan/pembaruan berhasil
 */
async function updateStudentTaskStatus(dbClient, studentId, taskId, isCompleted) {
  // Gunakan pencarian manual terlebih dahulu untuk menjamin db-agnostic (idempotent)
  const checkQuery = 'SELECT id FROM pkl_student_tasks WHERE student_id = ? AND task_id = ?';
  const [rows] = await dbClient.query(checkQuery, [studentId, taskId]);

  if (rows.length > 0) {
    const updateQuery = 'UPDATE pkl_student_tasks SET is_completed = ?, updated_at = NOW() WHERE id = ?';
    const [result] = await dbClient.query(updateQuery, [isCompleted, rows[0].id]);
    return result.affectedRows > 0;
  } else {
    const insertQuery = 'INSERT INTO pkl_student_tasks (id, student_id, task_id, is_completed, updated_at) VALUES (?, ?, ?, ?, NOW())';
    const newId = `st-${studentId}-${taskId}`;
    const [result] = await dbClient.query(insertQuery, [newId, studentId, taskId, isCompleted]);
    return result.affectedRows > 0;
  }
}

module.exports = {
  findTemplates,
  findWeeksByTemplateId,
  findTasksByWeekId,
  findTasksByStudentId,
  updateStudentTaskStatus
};
