const { seedUsers } = require('./users.seeder');
const { seedSettings } = require('./settings.seeder');
const { seedPkl } = require('./pkl.seeder');
const { seedAttendance } = require('./attendance.seeder');

/**
 * Fungsi utama untuk mengeksekusi seluruh seeder secara berurutan sesuai dependency graph
 * @param {object} dbClient 
 */
async function executeAllSeeders(dbClient) {
  console.log('[Seeder] Memulai eksekusi seluruh database seeder...');
  try {
    // Jalankan berdasarkan urutan dependency:
    // 1. Users & Settings (independen)
    await seedUsers(dbClient);
    await seedSettings(dbClient);

    // 2. PKL (bergantung pada Users)
    await seedPkl(dbClient);

    // 3. Attendance (bergantung pada Users)
    await seedAttendance(dbClient);

    console.log('[Seeder] Seluruh database seeder selesai dieksekusi dengan sukses.');
  } catch (error) {
    console.error('[Seeder] Terjadi Eror fatal saat menjalankan database seeder:', error);
    throw error;
  }
}

/**
 * Entry point eksekusi seeder dengan deteksi mode (Development vs Production)
 * @param {object} dbClient 
 */
async function runSeeders(dbClient) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    console.log('[Seeder] Mode Produksi aktif. Auto-seeding dinonaktifkan secara aman.');
    return;
  }

  // Pada mode Development / Testing, periksa apakah database kosong
  console.log('[Seeder] Mode Development aktif. Memeriksa kapasitas basis data...');
  try {
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM users');
    // Jika jumlah user <= 1 (artinya db kosong atau hanya ada admin default),
    // kita asumsikan ini db baru/bersih dan jalankan auto-seeding.
    if (rows[0].cnt <= 1) {
      console.log('[Seeder] Database kosong atau belum terkonfigurasi. Memulai auto-seeding data dummy...');
      await executeAllSeeders(dbClient);
    } else {
      console.log('[Seeder] Database sudah berisi data. Auto-seeding dilewati agar tidak menimpa data pengujian.');
    }
  } catch (error) {
    console.error('[Seeder] Gagal melakukan pengecekan kapasitas basis data untuk auto-seeding:', error);
  }
}

module.exports = {
  runSeeders,
  executeAllSeeders
};
