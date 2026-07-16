const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const r = await pool.query(`
    SELECT 
      id,
      waktu_absen,
      waktu_absen::text as raw_text,
      status,
      diubah_oleh_admin
    FROM absensi 
    WHERE user_id = (SELECT id FROM users WHERE nama_lengkap = 'Ahmadi Jaka Abdul Manaf')
      AND (DATE(waktu_absen) = '2026-07-15' OR DATE(waktu_absen) = '2026-07-16' OR DATE(waktu_absen + INTERVAL '7 hour') = '2026-07-15' OR DATE(waktu_absen + INTERVAL '7 hour') = '2026-07-16')
    ORDER BY waktu_absen DESC
  `);
  console.log('=== Database records for Jaka on July 15 & 16 ===');
  console.table(r.rows);
  await pool.end();
}

main().catch(console.error);
