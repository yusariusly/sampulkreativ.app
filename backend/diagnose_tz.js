const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // 1. Check how PostgreSQL interprets the timestamp comparison
  const r1 = await pool.query(`
    SELECT 
      '2026-07-16T00:00:00+07:00'::timestamptz as ts_start_utc,
      '2026-07-15T10:11:04Z'::timestamptz as record_utc,
      '2026-07-15T10:11:04Z'::timestamptz >= '2026-07-16T00:00:00+07:00'::timestamptz as is_hari_ini
  `);
  console.log('=== PostgreSQL Timezone Test ===');
  console.log(r1.rows[0]);

  // 2. Check what the actual timezone is on the DB
  const r2 = await pool.query(`SELECT current_setting('TIMEZONE') as tz, NOW() as now_utc, NOW() AT TIME ZONE 'Asia/Jakarta' as now_jakarta`);
  console.log('\n=== DB Server Timezone ===');
  console.log(r2.rows[0]);

  // 3. Replicate the exact query
  const startTimestamp = '2026-07-16T00:00:00+07:00';
  const endTimestamp = '2026-07-17T00:00:00+07:00';
  const userId = (await pool.query(`SELECT id FROM users WHERE nama_lengkap ILIKE '%Fakhrul%' LIMIT 1`)).rows[0]?.id;
  
  if (userId) {
    const r3 = await pool.query(
      `SELECT status, waktu_absen, waktu_absen AT TIME ZONE 'Asia/Jakarta' as waktu_jakarta
       FROM absensi 
       WHERE user_id = $1 
         AND waktu_absen >= $2::timestamptz 
         AND waktu_absen < $3::timestamptz`,
      [userId, startTimestamp, endTimestamp]
    );
    console.log('\n=== Absensi Fakhrul "hari ini" (query exact replicate) ===');
    console.log('startTimestamp =', startTimestamp, '=> UTC =', new Date(startTimestamp).toISOString());
    console.log('endTimestamp =', endTimestamp, '=> UTC =', new Date(endTimestamp).toISOString());
    console.table(r3.rows);
  }
  
  await pool.end();
}

main().catch(console.error);
