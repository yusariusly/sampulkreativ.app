const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // 1. Check absensi records for employees with issue (last 3 days)
    const res = await pool.query(`
      SELECT 
        u.nama_lengkap,
        a.status,
        a.waktu_absen,
        a.waktu_absen AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' as waktu_jakarta,
        (a.waktu_absen AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date as tanggal_jakarta
      FROM absensi a
      JOIN users u ON u.id = a.user_id
      WHERE u.nama_lengkap IN ('Fakhrul Miandi Rachman', 'Muhammad Yusar Ghani')
        AND a.waktu_absen >= NOW() - INTERVAL '3 days'
      ORDER BY u.nama_lengkap, a.waktu_absen DESC
    `);

    console.log('=== Data Absensi 3 Hari Terakhir ===');
    console.table(res.rows.map(r => ({
      nama: r.nama_lengkap,
      status: r.status,
      waktu_utc: new Date(r.waktu_absen).toISOString(),
      waktu_jakarta: r.waktu_jakarta?.toISOString?.() ?? r.waktu_jakarta,
      tanggal_jakarta: r.tanggal_jakarta
    })));

    // 2. Simulate the query used by getTodayRemoteFacts
    const todayJakarta = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowJakarta = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(tomorrow);

    const startTimestamp = `${todayJakarta}T00:00:00+07:00`;
    const endTimestamp = `${tomorrowJakarta}T00:00:00+07:00`;

    console.log('\n=== Query Parameters ===');
    console.log('today (Jakarta):', todayJakarta);
    console.log('startTimestamp:', startTimestamp);
    console.log('endTimestamp:', endTimestamp);
    console.log('Current UTC:', new Date().toISOString());
    console.log('Current Jakarta:', new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date()));

    // 3. Check what the query actually returns for each employee
    for (const nama of ['Fakhrul Miandi Rachman', 'Muhammad Yusar Ghani']) {
      const userRes = await pool.query(`SELECT id FROM users WHERE nama_lengkap = $1`, [nama]);
      if (userRes.rows.length === 0) { console.log(`${nama} not found`); continue; }
      const userId = userRes.rows[0].id;

      const absensiRes = await pool.query(
        `SELECT status, waktu_absen,
                waktu_absen AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' as waktu_jakarta
         FROM absensi 
         WHERE user_id = $1 
           AND waktu_absen >= $2::timestamptz 
           AND waktu_absen < $3::timestamptz`,
        [userId, startTimestamp, endTimestamp]
      );

      console.log(`\n=== Absensi HARI INI (${todayJakarta}) untuk ${nama} ===`);
      if (absensiRes.rows.length === 0) {
        console.log('Tidak ada absensi hari ini');
      } else {
        console.table(absensiRes.rows.map(r => ({
          status: r.status,
          waktu_utc: new Date(r.waktu_absen).toISOString(),
          waktu_jakarta: r.waktu_jakarta
        })));
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
