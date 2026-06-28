const { getRelativeDateStr, isWorkDay } = require('./helper');

async function seedAttendance(dbClient) {
  console.log('[Seeder] Menjalankan seeder Attendance...');
  let createdCount = 0;

  const students = [
    { id: 'usr-student', username: 'siswa', name: 'Siswa Magang 1' },
    { id: 'usr-student2', username: 'siswa2', name: 'Siswa Magang 2' }
  ];

  // Jalankan untuk 20 hari kerja terakhir
  for (let i = -20; i < 0; i++) {
    const dateStr = getRelativeDateStr(i);
    if (!isWorkDay(dateStr)) continue;

    for (const std of students) {
      // 1. Check & Seed Absensi Masuk (Sekitar Jam 08:00 pagi)
      const idMasuk = `att-${std.username}-${dateStr}-masuk`;
      const [rowsMasuk] = await dbClient.query('SELECT COUNT(*) as cnt FROM absensi WHERE id = ?', [idMasuk]);
      if (rowsMasuk[0].cnt === 0) {
        // Random waktu antara 07:45 dan 08:15 pagi
        const randomMinutes = Math.floor(Math.random() * 30) - 15; // -15 s.d +15 menit
        const hour = 8;
        const minutes = 0 + randomMinutes;
        const formattedTime = `${dateStr} ${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

        await dbClient.query(
          `INSERT INTO absensi (id, user_id, username, nama_lengkap, waktu_absen, foto_url, latitude, longitude, status, diubah_oleh_admin) 
           VALUES (?, ?, ?, ?, ?, ?, -6.175110, 106.865039, 'MASUK', 0)`,
          [idMasuk, std.id, std.username, std.name, formattedTime, '/uploads/attendance_dummy.jpg']
        );
        createdCount++;
      }

      // 2. Check & Seed Absensi Pulang (Sekitar Jam 17:00 sore)
      const idPulang = `att-${std.username}-${dateStr}-pulang`;
      const [rowsPulang] = await dbClient.query('SELECT COUNT(*) as cnt FROM absensi WHERE id = ?', [idPulang]);
      if (rowsPulang[0].cnt === 0) {
        // Random waktu antara 17:00 dan 17:30 sore
        const randomMinutes = Math.floor(Math.random() * 30); // 0 s.d +30 menit
        const hour = 17;
        const minutes = 0 + randomMinutes;
        const formattedTime = `${dateStr} ${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

        await dbClient.query(
          `INSERT INTO absensi (id, user_id, username, nama_lengkap, waktu_absen, foto_url, latitude, longitude, status, diubah_oleh_admin) 
           VALUES (?, ?, ?, ?, ?, ?, -6.175110, 106.865039, 'PULANG', 0)`,
          [idPulang, std.id, std.username, std.name, formattedTime, '/uploads/attendance_dummy.jpg']
        );
        createdCount++;
      }
    }
  }

  console.log(`[Seeder] Seeder Attendance selesai. Record dibuat: ${createdCount}`);
}

module.exports = { seedAttendance };
