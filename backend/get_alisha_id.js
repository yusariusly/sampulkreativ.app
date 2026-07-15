const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    const studentRes = await pool.query(
      `SELECT ps.id as student_id, ps.user_id, ps.start_date, ps.end_date, u.nama_lengkap
       FROM pkl_students ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.nama_lengkap ILIKE '%Alisha%'`
    );
    console.log('Alisha Student info:', studentRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
