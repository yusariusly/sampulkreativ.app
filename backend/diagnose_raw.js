const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // Cek raw data absensi hari ini dan kemarin
  const r = await pool.query(`
    SELECT 
      u.nama_lengkap,
      a.status,
      a.waktu_absen::text as raw_stored,
      DATE(a.waktu_absen) as tanggal_date,
      a.waktu_absen AT TIME ZONE 'Asia/Jakarta' as waktu_jakarta_display
    FROM absensi a
    JOIN users u ON u.id = a.user_id
    WHERE a.waktu_absen >= NOW() - INTERVAL '36 hours'
    ORDER BY a.waktu_absen DESC
  `);
  
  console.log('=== Data Absensi Raw (36 jam terakhir) ===');
  console.table(r.rows.map(x => ({
    nama: x.nama_lengkap,
    status: x.status,
    raw_stored: x.raw_stored,
    tanggal_DATE: x.tanggal_date,
    jakarta_display: x.waktu_jakarta_display
  })));

  // Simulasi query baru dengan DATE()
  const todayJakarta = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

  console.log('\n=== Cek: Siapa yang terhitung "SUDAH PULANG HARI INI" dengan query baru? ===');
  console.log('todayJakarta =', todayJakarta);
  
  const r2 = await pool.query(`
    SELECT u.nama_lengkap, a.status, a.waktu_absen::text as raw_stored, DATE(a.waktu_absen) as tanggal
    FROM absensi a
    JOIN users u ON u.id = a.user_id
    WHERE a.status = 'Pulang'
      AND DATE(a.waktu_absen) = $1
    ORDER BY u.nama_lengkap
  `, [todayJakarta]);

  if (r2.rows.length === 0) {
    console.log('✅ Tidak ada yang terhitung pulang hari ini - query baru benar!');
  } else {
    console.log('❌ Masih ada yang terhitung pulang hari ini:');
    console.table(r2.rows);
  }

  await pool.end();
}

main().catch(console.error);
