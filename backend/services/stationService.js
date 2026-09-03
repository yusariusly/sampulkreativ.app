const cryptoService = require('./cryptoService');
const remoteService = require('./remoteService');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Verifikasi token stasiun absensi (bisa token terenkripsi atau plaintext username fallback).
 * Mengembalikan data karyawan dan status absensi selanjutnya (Hadir / Terlambat / Pulang).
 */
async function verifyStationToken(pool, token) {
  if (!token || token.trim() === '') {
    return { success: false, error: 'Token absensi kosong.' };
  }

  // 1. Dekripsi token
  let username = cryptoService.decrypt(token);
  if (!username) {
    // Fallback jika berupa username biasa (plaintext untuk demo/kompatibilitas)
    username = token.trim();
  }

  // 2. Cari data karyawan
  const [userRows] = await pool.query(
    "SELECT id, username, nama_lengkap, role, is_active FROM users WHERE LOWER(username) = ? LIMIT 1",
    [username.toLowerCase()]
  );

  if (userRows.length === 0) {
    return { success: false, error: 'Karyawan tidak ditemukan.' };
  }

  const user = userRows[0];
  if (user.is_active !== 1) {
    return { success: false, error: 'Akun Karyawan dinonaktifkan oleh administrator.' };
  }

  // 3. Tarik jam masuk kantor (deadline_time) & jam pulang (checkout_time)
  const [settings] = await pool.query("SELECT key_name, key_value FROM settings WHERE key_name IN ('deadline_time', 'checkout_time')");
  const deadlineVal = settings.find(s => s.key_name === 'deadline_time')?.key_value || '08:30';
  const checkoutVal = settings.find(s => s.key_name === 'checkout_time')?.key_value || '17:00';

  // 4. Tarik log absensi hari berjalan berdasarkan timezone Jakarta
  const todayJakarta = remoteService.getJakartaDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowJakarta = remoteService.getJakartaDate(tomorrow);

  const [logs] = await pool.query(
    `SELECT status, waktu_absen FROM absensi 
     WHERE user_id = ? 
       AND DATE(waktu_absen) = ?
     ORDER BY waktu_absen ASC`,
    [user.id, todayJakarta]
  );

  // 5. Analisis logs hari ini
  const hasPulang = logs.some(l => l.status === 'Pulang');
  const hasIzin = logs.some(l => l.status === 'Izin');
  const hasSakit = logs.some(l => l.status === 'Sakit');
  const hasClockedIn = logs.some(l => l.status === 'Hadir' || l.status === 'Terlambat');

  if (hasPulang) {
    return {
      success: false,
      error: `Halo ${user.nama_lengkap}, Anda sudah melakukan absensi pulang hari ini.`,
      user: { id: user.id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role }
    };
  }

  if (hasIzin) {
    return {
      success: false,
      error: `Halo ${user.nama_lengkap}, Anda tidak bisa absen karena terdaftar sedang Izin hari ini.`,
      user: { id: user.id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role }
    };
  }

  if (hasSakit) {
    return {
      success: false,
      error: `Halo ${user.nama_lengkap}, Anda tidak bisa absen karena terdaftar sedang Sakit hari ini.`,
      user: { id: user.id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role }
    };
  }

  // Ambil waktu Jakarta saat ini untuk penentuan status
  const currentJakartaTimeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());

  if (hasClockedIn) {
    // Karyawan ingin absen pulang. Diperbolehkan kapan saja setelah absen masuk
    return {
      success: true,
      user: { id: user.id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role },
      next_status: 'Pulang'
    };
  }

  // Belum absen masuk. Selalu tandai 'Hadir' (tidak ada status Terlambat)
  const next_status = 'Hadir';

  return {
    success: true,
    user: { id: user.id, username: user.username, nama_lengkap: user.nama_lengkap, role: user.role },
    next_status
  };
}

/**
 * Mencatat absensi stasiun ke database dan mengunggah selfie
 */
async function checkinStation(pool, user, status, foto_base64, hasTelegram, latitude = null, longitude = null) {
  let fotoUrl = '/uploads/placeholder.jpg';
  let fileBuffer = null;
  let filename = '';
  let mimeType = 'image/jpeg';

  if (foto_base64 && typeof foto_base64 === 'string') {
    const cleanedBase64 = foto_base64.trim();
    if (cleanedBase64.startsWith('data:image')) {
      try {
        const matches = cleanedBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1] || 'image/jpeg';
          let ext = mimeType.split('/')[1] || 'jpg';
          if (ext === 'jpeg') ext = 'jpg';

          const rawBase64 = matches[2].replace(/\s/g, '');
          fileBuffer = Buffer.from(rawBase64, 'base64');
          filename = `selfie-station-${user.username}-${Date.now()}.${ext}`;

          if (hasTelegram) {
            // Lewatkan penyimpanan lokal jika Telegram aktif (menghemat disk space)
            fotoUrl = 'telegram';
          } else {
            const filepath = path.join(uploadDir, filename);
            await fs.promises.writeFile(filepath, fileBuffer);
            fotoUrl = `/uploads/${filename}`;
          }
        }
      } catch (err) {
        console.error('Gagal menulis file selfie stasiun:', err);
      }
    }
  }

  const newRecord = {
    id: `att-${Date.now()}`,
    user_id: user.id,
    username: user.username,
    nama_lengkap: user.nama_lengkap,
    waktu_absen: new Date().toISOString(),
    foto_url: fotoUrl,
    latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : null,
    longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : null,
    status: status,
    diubah_oleh_admin: 0
  };

  await pool.query(
    `INSERT INTO absensi (id, user_id, username, nama_lengkap, waktu_absen, foto_url, latitude, longitude, status, diubah_oleh_admin) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newRecord.id,
      newRecord.user_id,
      newRecord.username,
      newRecord.nama_lengkap,
      new Date(newRecord.waktu_absen),
      newRecord.foto_url,
      newRecord.latitude,
      newRecord.longitude,
      newRecord.status,
      newRecord.diubah_oleh_admin
    ]
  );

  return { newRecord, fileBuffer, filename, mimeType };
}

module.exports = {
  verifyStationToken,
  checkinStation
};
