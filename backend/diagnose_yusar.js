const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const r = await pool.query(`
    SELECT 
      id,
      waktu_absen,
      waktu_absen::text as raw_text,
      status
    FROM absensi 
    WHERE user_id = (SELECT id FROM users WHERE nama_lengkap = 'Muhammad Yusar Ghani')
      AND DATE(waktu_absen) = '2026-07-16'
    ORDER BY waktu_absen DESC
  `);
  console.log('=== Database records for Yusar on 2026-07-16 ===');
  console.table(r.rows);
  await pool.end();
}

main().catch(console.error);
