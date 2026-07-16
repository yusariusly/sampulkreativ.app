const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // Hapus semua data absensi Jaka untuk tanggal 15 Juli agar bersih
  const res = await pool.query(`
    DELETE FROM absensi 
    WHERE user_id = (SELECT id FROM users WHERE nama_lengkap = 'Ahmadi Jaka Abdul Manaf')
      AND DATE(waktu_absen) = '2026-07-15'
  `);
  console.log('Deleted rows:', res.rowCount);
  await pool.end();
}

main().catch(console.error);
