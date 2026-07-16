const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // Check column type
  const r1 = await pool.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'absensi' 
    ORDER BY ordinal_position
  `);
  console.log('=== Kolom tabel absensi ===');
  console.table(r1.rows);

  // Check a few recent records to understand how waktu_absen is stored
  const r2 = await pool.query(`
    SELECT 
      waktu_absen,
      pg_typeof(waktu_absen) as tipe_kolom,
      waktu_absen::text as raw_text
    FROM absensi 
    ORDER BY waktu_absen DESC 
    LIMIT 5
  `);
  console.log('\n=== Sample Data waktu_absen ===');
  console.table(r2.rows);

  await pool.end();
}

main().catch(console.error);
