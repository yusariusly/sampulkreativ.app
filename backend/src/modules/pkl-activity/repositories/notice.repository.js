/**
 * @module NoticeRepository
 * @description Database operations for the pkl_notices table.
 */

/**
 * Mendapatkan notice berdasarkan nomor minggu (week_number)
 * @param {object} dbClient - Database client/pool
 * @param {number} weekNumber - Nomor Minggu Cohort
 * @returns {Promise<object|null>} Data notice
 */
async function findByWeekNumber(dbClient, weekNumber) {
  const query = `
    SELECT id, week_number, reward_title, reward_description, prize_name, prize_image_url, show_congrats, show_recipients, auto_show_recipients,
           punishment_title, punishment_description, consequence, consequence_image_url, is_active, created_at, updated_at
    FROM pkl_notices
    WHERE week_number = ?
  `;
  const [rows] = await dbClient.query(query, [weekNumber]);
  return rows[0] || null;
}

/**
 * Mendapatkan seluruh daftar notice terurut dari minggu terbaru
 * @param {object} dbClient - Database client/pool
 * @returns {Promise<Array<object>>} Daftar notice
 */
async function findAll(dbClient) {
  const query = `
    SELECT id, week_number, reward_title, reward_description, prize_name, prize_image_url, show_congrats, show_recipients, auto_show_recipients,
           punishment_title, punishment_description, consequence, consequence_image_url, is_active, created_at, updated_at
    FROM pkl_notices
    ORDER BY week_number DESC
  `;
  const [rows] = await dbClient.query(query);
  return rows;
}

/**
 * Menyimpan atau memperbarui notice berdasarkan week_number (Upsert)
 * @param {object} dbClient - Database client/pool
 * @param {object} data - Data notice
 * @returns {Promise<boolean>} True jika berhasil
 */
async function upsert(dbClient, data) {
  const checkQuery = 'SELECT id FROM pkl_notices WHERE week_number = ?';
  const [rows] = await dbClient.query(checkQuery, [data.week_number]);

  if (rows.length > 0) {
    const updateQuery = `
      UPDATE pkl_notices 
      SET reward_title = ?, reward_description = ?, prize_name = ?, prize_image_url = ?, show_congrats = ?, show_recipients = ?, auto_show_recipients = ?,
          punishment_title = ?, punishment_description = ?, consequence = ?, consequence_image_url = ?, is_active = ?, updated_at = NOW()
      WHERE id = ?
    `;
    const [result] = await dbClient.query(updateQuery, [
      data.reward_title,
      data.reward_description,
      data.prize_name,
      data.prize_image_url,
      data.show_congrats ? 1 : 0,
      data.show_recipients ? 1 : 0,
      data.auto_show_recipients ? 1 : 0,
      data.punishment_title,
      data.punishment_description,
      data.consequence,
      data.consequence_image_url,
      data.is_active ? 1 : 0,
      rows[0].id
    ]);
    return result.affectedRows > 0;
  } else {
    const insertQuery = `
      INSERT INTO pkl_notices (
        week_number, reward_title, reward_description, prize_name, prize_image_url, show_congrats, show_recipients, auto_show_recipients,
        punishment_title, punishment_description, consequence, consequence_image_url, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const [result] = await dbClient.query(insertQuery, [
      data.week_number,
      data.reward_title,
      data.reward_description,
      data.prize_name,
      data.prize_image_url,
      data.show_congrats ? 1 : 0,
      data.show_recipients ? 1 : 0,
      data.auto_show_recipients ? 1 : 0,
      data.punishment_title,
      data.punishment_description,
      data.consequence,
      data.consequence_image_url,
      data.is_active ? 1 : 0
    ]);
    return result.affectedRows > 0;
  }
}

/**
 * Menghapus notice berdasarkan ID
 * @param {object} dbClient - Database client/pool
 * @param {number} id - ID notice
 * @returns {Promise<boolean>} True jika berhasil
 */
async function deleteNotice(dbClient, id) {
  const query = 'DELETE FROM pkl_notices WHERE id = ?';
  const [result] = await dbClient.query(query, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  findByWeekNumber,
  findAll,
  upsert,
  deleteNotice
};
