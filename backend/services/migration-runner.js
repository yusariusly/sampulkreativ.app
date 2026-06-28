const fs = require('fs');
const path = require('path');

/**
 * Parsir isi file SQL menjadi sekumpulan statement mandiri (membuang komentar & split per semicolon)
 * @param {string} sqlContent 
 * @returns {string[]}
 */
function parseSqlStatements(sqlContent) {
  // Hapus komentar multi-line /* ... */
  let sql = sqlContent.replace(/\/\*[\s\S]*?\*\//g, '');
  // Hapus komentar single-line -- ...
  sql = sql
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--');
      return idx !== -1 ? line.substring(0, idx) : line;
    })
    .join('\n');

  // Pisahkan berdasarkan semicolon dan saring baris kosong
  return sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
}

/**
 * Menjalankan migrasi basis data secara terprogram berbasis berkas .up.sql
 * @param {object} dbClient 
 */
async function runMigrations(dbClient) {
  console.log('[Migration] Memulai verifikasi skema migrasi...');

  // 1. Buat tabel pelacak migrasi jika belum ada
  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Scan direktori migrations/
  const migrationsDir = path.join(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn(`[Migration] Direktori migrasi tidak ditemukan di: ${migrationsDir}`);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.up.sql'))
    .sort(); // Urutan alfabetis menjamin urutan 001, 002, dst.

  // 3. Ambil daftar migrasi yang sudah dieksekusi dari database
  const [rows] = await dbClient.query('SELECT migration_name FROM schema_migrations');
  const executedMigrations = new Set(rows.map(r => r.migration_name));

  console.log(`[Migration] Ditemukan ${files.length} file migrasi. ${executedMigrations.size} sudah dijalankan sebelumnya.`);

  // 4. Eksekusi migrasi baru
  for (const file of files) {
    if (executedMigrations.has(file)) {
      // Lewati migrasi yang sudah pernah sukses dijalankan
      continue;
    }

    console.log(`[Migration] Menjalankan migrasi: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    const statements = parseSqlStatements(sqlContent);

    // Jalankan seluruh statement dalam berkas ini di dalam satu database transaction
    await dbClient.query('BEGIN');
    try {
      for (const statement of statements) {
        await dbClient.query(statement);
      }

      // Catat nama file ke tabel schema_migrations
      await dbClient.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
      await dbClient.query('COMMIT');
      console.log(`[Migration] Sukses menyelesaikan: ${file}`);
    } catch (error) {
      await dbClient.query('ROLLBACK');
      console.error(`[Migration] GAGAL menjalankan ${file}. Seluruh perubahan pada berkas ini dibatalkan (rolled back).`);
      console.error(error);
      throw error; // Hentikan seluruh booting aplikasi jika migrasi gagal
    }
  }

  console.log('[Migration] Seluruh migrasi skema basis data selesai divalidasi.');
}

module.exports = { runMigrations };
