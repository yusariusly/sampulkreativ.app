const express = require('express');
const mysql = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/uploads', express.static(uploadDir));

const pgPool = new mysql.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/absensi_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const pool = {
  query: async (text, params) => {
    let pgText = text;
    pgText = pgText.replace(/TINYINT\(1\)/gi, 'SMALLINT');
    pgText = pgText.replace(/DATETIME/gi, 'TIMESTAMP');
    pgText = pgText.replace(/ON DUPLICATE KEY UPDATE token = \?, created_at = \?, is_active = \?/gi, 
      'ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token, created_at = EXCLUDED.created_at, is_active = EXCLUDED.is_active');
    pgText = pgText.replace(/ON DUPLICATE KEY UPDATE key_value = \?/gi, 
      'ON CONFLICT (key_name) DO UPDATE SET key_value = EXCLUDED.key_value');
    pgText = pgText.replace(/ON DUPLICATE KEY UPDATE key_value = key_value/gi, 
      'ON CONFLICT (key_name) DO NOTHING');

    let paramIndex = 1;
    pgText = pgText.replace(/\?/g, () => `$${paramIndex++}`);

    const finalParams = params ? params.slice(0, paramIndex - 1) : params;
    const res = await pgPool.query(pgText, finalParams);
    
    const rows = res.rows.map(row => {
      const mappedRow = { ...row };
      for (const key in mappedRow) {
        if (key === 'cnt' || key === 'count') {
          mappedRow[key] = Number(mappedRow[key]);
        }
      }
      return mappedRow;
    });

    return [rows];
  }
};

// Initialize Database Tables and Seeds
let isDbInitialized = false;
async function initDb() {
  if (isDbInitialized) return;
  try {
    // 1. Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nama_lengkap VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        foto_profile VARCHAR(255) DEFAULT '/uploads/placeholder.jpg'
      )
    `);

    // Migration to add column if table exists without it
    try {
      await pool.query("ALTER TABLE users ADD COLUMN foto_profile VARCHAR(255) DEFAULT '/uploads/placeholder.jpg'");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN device_id VARCHAR(100) NULL");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN device_info VARCHAR(255) NULL");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS absensi (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        username VARCHAR(50) NOT NULL,
        nama_lengkap VARCHAR(100) NOT NULL,
        waktu_absen DATETIME NOT NULL,
        foto_url VARCHAR(255) NOT NULL,
        latitude DECIMAL(10, 8) NULL,
        longitude DECIMAL(11, 8) NULL,
        status VARCHAR(20) NOT NULL,
        diubah_oleh_admin TINYINT(1) DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS qr_token (
        id VARCHAR(50) PRIMARY KEY,
        token VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL,
        is_active TINYINT(1) DEFAULT 1
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key_name VARCHAR(50) PRIMARY KEY,
        key_value VARCHAR(255) NOT NULL
      )
    `);

    // 2. Seed default users if empty
    const [userRows] = await pool.query("SELECT COUNT(*) as cnt FROM users");
    if (userRows[0].cnt === 0) {
      await pool.query(`
        INSERT INTO users (id, username, password, nama_lengkap, role, is_active, foto_profile) VALUES
        ('usr-admin', 'admin', 'admin', 'Administrator', 'admin', 1, '/uploads/placeholder.jpg'),
        ('usr-ghani', 'ghani', 'ghani', 'Muhammad Yusar Ghani', 'user', 1, '/uploads/placeholder.jpg'),
        ('usr-john', 'jdoe123', '123', 'John Doe', 'user', 1, '/uploads/placeholder.jpg'),
        ('usr-smyth', 'smyth.j', '123', 'Sarah Smyth', 'user', 1, '/uploads/placeholder.jpg')
      `);
    }

    // 3. Seed default settings if empty
    const [settingRows] = await pool.query("SELECT COUNT(*) as cnt FROM settings");
    if (settingRows[0].cnt === 0) {
      await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('deadline_time', '08:30')");
    }
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('telegram_bot_token', '') ON DUPLICATE KEY UPDATE key_value = key_value");
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('telegram_chat_id', '') ON DUPLICATE KEY UPDATE key_value = key_value");

    // 4. Seed default QR if empty
    const [qrRows] = await pool.query("SELECT COUNT(*) as cnt FROM qr_token");
    if (qrRows[0].cnt === 0) {
      await pool.query(`
        INSERT INTO qr_token (id, token, created_at, is_active) VALUES 
        ('qr-default', 'ABSENSI-KANTOR-PENGESAHAN-TOKEN-2026', NOW(), 1)
      `);
    }

    isDbInitialized = true;
    console.log("Database initialized and verified successfully.");
  } catch (error) {
    console.error("Gagal melakukan inisialisasi basis data MySQL:", error);
  }
}

// Middleware to ensure DB is initialized before handling requests
app.use(async (req, res, next) => {
  await initDb();
  next();
});

// API Routes

// 1. Auth Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = ? AND password = ? AND is_active = 1',
      [username.trim().toLowerCase(), password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Username atau password salah / akun tidak aktif' });
    }

    const user = rows[0];
    res.json({
      id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      foto_profile: user.foto_profile || '/uploads/placeholder.jpg'
    });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan internal server' });
  }
});

app.post('/api/auth/register-device', async (req, res) => {
  try {
    const { nama_lengkap, username, device_id, device_info } = req.body;
    if (!nama_lengkap || !username || !device_id) {
      return res.status(400).json({ error: 'Nama Lengkap, Nomor HP, dan Perangkat wajib diisi' });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedNama = nama_lengkap.trim();

    // Check if username already exists
    const [existing] = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = ?',
      [trimmedUsername]
    );

    let user;
    if (existing.length > 0) {
      user = existing[0];
      if (user.is_active !== 1) {
        return res.status(401).json({ error: 'Akun Anda dinonaktifkan oleh administrator' });
      }

      // Lock to device: check if device_id matches
      if (user.device_id && user.device_id.trim() !== '' && user.device_id !== device_id) {
        return res.status(403).json({ 
          error: `Nomor HP ini sudah terikat pada HP lain (${user.device_info || 'Perangkat lain'}). Silakan hubungi Administrator untuk mereset perangkat Anda.` 
        });
      }

      // If no device_id bound yet (e.g. added by admin or reset), bind it now
      if (!user.device_id || user.device_id.trim() === '') {
        await pool.query(
          'UPDATE users SET device_id = ?, device_info = ? WHERE id = ?',
          [device_id, device_info, user.id]
        );
        user.device_id = device_id;
        user.device_info = device_info;
      }
    } else {
      const userId = `usr-${Date.now()}`;
      await pool.query(
        'INSERT INTO users (id, username, password, nama_lengkap, role, is_active, foto_profile, device_id, device_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, trimmedUsername, 'no_password', trimmedNama, 'user', 1, '/uploads/placeholder.jpg', device_id, device_info]
      );
      user = {
        id: userId,
        username: trimmedUsername,
        nama_lengkap: trimmedNama,
        role: 'user',
        foto_profile: '/uploads/placeholder.jpg',
        device_id: device_id,
        device_info: device_info
      };
    }

    res.json({
      id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      foto_profile: user.foto_profile || '/uploads/placeholder.jpg',
      device_id: user.device_id,
      device_info: user.device_info
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal melakukan registrasi perangkat' });
  }
});

app.get('/api/auth/check-device', async (req, res) => {
  try {
    const { device_id } = req.query;
    if (!device_id || device_id.trim() === '') {
      return res.status(400).json({ error: 'Device ID wajib disertakan' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, nama_lengkap, role, is_active, foto_profile, device_id, device_info FROM users WHERE device_id = ? AND is_active = 1 LIMIT 1',
      [device_id.trim()]
    );

    if (rows.length === 0) {
      return res.json({ registered: false });
    }

    const user = rows[0];
    res.json({
      registered: true,
      user: {
        id: user.id,
        username: user.username,
        nama_lengkap: user.nama_lengkap,
        role: user.role,
        foto_profile: user.foto_profile || '/uploads/placeholder.jpg',
        device_id: user.device_id,
        device_info: user.device_info
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mencocokkan perangkat' });
  }
});

// 2. Attendance GET & POST
app.get('/api/attendance', async (req, res) => {
  try {
    const { user_id } = req.query;
    let query = 'SELECT * FROM absensi';
    let params = [];

    if (user_id) {
      query += ' WHERE user_id = ?';
      params.push(user_id);
    }
    query += ' ORDER BY waktu_absen DESC';

    const [rows] = await pool.query(query, params);
    
    // Map database fields to response layout
    const mapped = rows.map(a => ({
      ...a,
      latitude: a.latitude !== null ? Number(a.latitude) : null,
      longitude: a.longitude !== null ? Number(a.longitude) : null,
      waktu_absen: new Date(a.waktu_absen).toISOString(),
      diubah_oleh_admin: a.diubah_oleh_admin === 1
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data absensi' });
  }
});

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // returns distance in meters
}

const https = require('https');

function sendTelegramPhoto(botToken, chatId, photoPath, caption) {
  return new Promise((resolve, reject) => {
    const boundary = '----TelegramBotBoundary' + Math.random().toString(36).substring(2);
    const filename = path.basename(photoPath);
    
    let fileBuffer;
    try {
      fileBuffer = fs.readFileSync(photoPath);
    } catch (e) {
      return reject(e);
    }

    const postDataHeader = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="chat_id"\r\n\r\n` +
      `${chatId}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="caption"\r\n\r\n` +
      `${caption}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="photo"; filename="${filename}"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n`;

    const postDataFooter = `\r\n--${boundary}--\r\n`;

    const payload = Buffer.concat([
      Buffer.from(postDataHeader, 'utf-8'),
      fileBuffer,
      Buffer.from(postDataFooter, 'utf-8')
    ]);

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendPhoto`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseBody));
        } else {
          reject(new Error(`Telegram API returned status code ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

function sendTelegramMessage(botToken, chatId, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text: text
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseBody));
        } else {
          reject(new Error(`Telegram API returned status ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function sendTelegramPhotoFromBuffer(botToken, chatId, fileBuffer, filename, caption) {
  return new Promise((resolve, reject) => {
    const boundary = '----TelegramBotBoundary' + Math.random().toString(36).substring(2);

    const postDataHeader = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="chat_id"\r\n\r\n` +
      `${chatId}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="caption"\r\n\r\n` +
      `${caption}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="photo"; filename="${filename}"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n`;

    const postDataFooter = `\r\n--${boundary}--\r\n`;

    const payload = Buffer.concat([
      Buffer.from(postDataHeader, 'utf-8'),
      fileBuffer,
      Buffer.from(postDataFooter, 'utf-8')
    ]);

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendPhoto`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseBody));
        } else {
          reject(new Error(`Telegram API returned status code ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function triggerTelegramNotification(newRecord, fileBuffer, filename) {
  try {
    const [botTokenSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_bot_token'");
    const [chatIdSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_chat_id'");
    
    const botToken = botTokenSetting[0]?.key_value;
    const chatId = chatIdSetting[0]?.key_value;

    if (!botToken || !chatId || botToken.trim() === '' || chatId.trim() === '') {
      console.log("Telegram notification skipped: Bot Token or Chat ID not configured.");
      return;
    }

    const timeObj = new Date(newRecord.waktu_absen);
    const formattedTime = timeObj.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
    
    let locationStr = 'Tidak Ada';
    if (newRecord.latitude && newRecord.longitude) {
      locationStr = `${newRecord.latitude}, ${newRecord.longitude}`;
    }

    const caption = 
      `📢 ABSENSI BARU MASUK\n\n` +
      `👤 Nama: ${newRecord.nama_lengkap}\n` +
      `🏷️ Username: @${newRecord.username}\n` +
      `⏰ Waktu: ${formattedTime}\n` +
      `📍 Lokasi: ${locationStr}\n` +
      `📝 Status: ${newRecord.status}`;

    if (newRecord.foto_url === 'telegram' && fileBuffer) {
      await sendTelegramPhotoFromBuffer(botToken, chatId, fileBuffer, filename, caption);
      return;
    }

    if (newRecord.foto_url && newRecord.foto_url !== '/uploads/placeholder.jpg' && newRecord.foto_url !== 'telegram') {
      const relativePath = newRecord.foto_url.replace('/uploads/', '');
      const photoPath = path.join(uploadDir, relativePath);

      if (fs.existsSync(photoPath)) {
        await sendTelegramPhoto(botToken, chatId, photoPath, caption);
        return;
      }
    }

    await sendTelegramMessage(botToken, chatId, caption);
  } catch (err) {
    console.error("Gagal mengirim notifikasi Telegram:", err);
  }
}

app.post('/api/attendance', async (req, res) => {
  try {
    const { user_id, foto_base64, latitude, longitude, status } = req.body;
    if (!user_id || !status) {
      return res.status(400).json({ error: 'Data absensi tidak lengkap' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const user = userRows[0];

    // Device Verification: Ensure the device matches registered device (only if device_id is set)
    if (user.role === 'user' && user.device_id && user.device_id.trim() !== '') {
      const { device_id } = req.body;
      if (!device_id || device_id !== user.device_id) {
        return res.status(403).json({ 
          error: 'Akses ditolak: Absensi harus dilakukan dari handphone yang terdaftar untuk akun ini.' 
        });
      }
    }

    // Distance/Coordinate verification (only if status is Hadir)
    if (status === 'Hadir') {
      const [latSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'office_latitude'");
      const [lngSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'office_longitude'");
      
      const officeLatStr = latSetting[0]?.key_value;
      const officeLngStr = lngSetting[0]?.key_value;
      
      if (officeLatStr && officeLngStr && officeLatStr.trim() !== '' && officeLngStr.trim() !== '') {
        const officeLat = parseFloat(officeLatStr);
        const officeLng = parseFloat(officeLngStr);
        
        if (!latitude || !longitude) {
          return res.status(400).json({ error: 'GPS perangkat wajib diaktifkan untuk melakukan absensi' });
        }
        
        const distance = getDistanceInMeters(parseFloat(latitude), parseFloat(longitude), officeLat, officeLng);
        if (distance > 100) {
          return res.status(400).json({ 
            error: `Jarak Anda terlalu jauh (${Math.round(distance)} meter dari kantor). Maksimal diperbolehkan: 100 meter.` 
          });
        }
      }
    }

    // Check if Telegram is configured to decide whether to save locally or bypass to telegram
    const [botTokenSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_bot_token'");
    const [chatIdSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_chat_id'");
    
    const botToken = botTokenSetting[0]?.key_value;
    const chatId = chatIdSetting[0]?.key_value;
    const hasTelegram = botToken && chatId && botToken.trim() !== '' && chatId.trim() !== '';

    // Process photo base64
    let fotoUrl = '/uploads/placeholder.jpg';
    let fileBuffer = null;
    let filename = '';

    if (foto_base64 && foto_base64.startsWith('data:image')) {
      try {
        const matches = foto_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const extension = matches[1].split('/')[1] || 'jpg';
          fileBuffer = Buffer.from(matches[2], 'base64');
          filename = `selfie-${user.username}-${Date.now()}.${extension}`;

          if (hasTelegram) {
            // Telegram is configured: do NOT save to local storage
            fotoUrl = 'telegram';
          } else {
            // Fallback to local storage if Telegram is not configured
            const filepath = path.join(uploadDir, filename);
            fs.writeFileSync(filepath, fileBuffer);
            fotoUrl = `/uploads/${filename}`;
          }
        }
      } catch (err) {
        console.error('Gagal memproses file foto selfie:', err);
      }
    }

    const newRecord = {
      id: `att-${Date.now()}`,
      user_id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      waktu_absen: new Date().toISOString(),
      foto_url: fotoUrl,
      latitude: latitude || null,
      longitude: longitude || null,
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

    // Trigger Telegram Notification in background with in-memory buffer if present
    triggerTelegramNotification(newRecord, fileBuffer, filename).catch(err => console.error("Error triggering telegram notification:", err));

    res.json({ success: true, record: { ...newRecord, diubah_oleh_admin: false } });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan absensi' });
  }
});

// 3. Attendance Override
app.post('/api/attendance/override', async (req, res) => {
  try {
    const { username, status } = req.body;
    if (!username || !status) {
      return res.status(400).json({ error: 'Username dan status wajib diisi' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE LOWER(username) = ?', [username.trim().toLowerCase()]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    }
    const user = userRows[0];

    // Today start in local timezone
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [existing] = await pool.query(
      'SELECT * FROM absensi WHERE user_id = ? AND waktu_absen >= ?',
      [user.id, todayStart]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE absensi SET status = ?, diubah_oleh_admin = 1 WHERE id = ?',
        [status, existing[0].id]
      );
    } else {
      const newRecordId = `att-override-${Date.now()}`;
      await pool.query(
        `INSERT INTO absensi (id, user_id, username, nama_lengkap, waktu_absen, foto_url, latitude, longitude, status, diubah_oleh_admin) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newRecordId,
          user.id,
          user.username,
          user.nama_lengkap,
          new Date(),
          '/uploads/placeholder.jpg',
          null,
          null,
          status,
          1
        ]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memproses override status' });
  }
});

// 4. Users CRUD API
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, nama_lengkap, role, is_active, foto_profile, device_id, device_info FROM users');
    const mapped = rows.map(u => ({
      ...u,
      is_active: u.is_active === 1
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat daftar pengguna' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { nama_lengkap, username, password, role } = req.body;
    if (!nama_lengkap || !username || !password || !role) {
      return res.status(400).json({ error: 'Data pengguna tidak lengkap' });
    }

    const [existRows] = await pool.query('SELECT * FROM users WHERE LOWER(username) = ?', [username.trim().toLowerCase()]);
    if (existRows.length > 0) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      username: username.trim().toLowerCase(),
      password: password,
      nama_lengkap: nama_lengkap.trim(),
      role: role.toLowerCase() === 'admin' ? 'admin' : 'user',
      is_active: 1,
      foto_profile: '/uploads/placeholder.jpg'
    };

    await pool.query(
      `INSERT INTO users (id, username, password, nama_lengkap, role, is_active, foto_profile) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newUser.id, newUser.username, newUser.password, newUser.nama_lengkap, newUser.role, newUser.is_active, newUser.foto_profile]
    );

    const { password: _, ...safeUser } = newUser;
    res.json({ success: true, user: { ...safeUser, is_active: true } });
  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat pengguna baru' });
  }
});

app.put('/api/users', async (req, res) => {
  try {
    const { id, nama_lengkap, username, password, role, is_active } = req.body;
    if (!id || !nama_lengkap || !username || !role) {
      return res.status(400).json({ error: 'Data update tidak lengkap' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const user = userRows[0];

    const [dupRows] = await pool.query('SELECT * FROM users WHERE id != ? AND LOWER(username) = ?', [id, username.trim().toLowerCase()]);
    if (dupRows.length > 0) {
      return res.status(400).json({ error: 'Username sudah digunakan oleh akun lain' });
    }

    let updateFields = 'nama_lengkap = ?, username = ?, role = ?';
    let params = [nama_lengkap.trim(), username.trim().toLowerCase(), role.toLowerCase() === 'admin' ? 'admin' : 'user'];

    if (is_active !== undefined) {
      if (user.username === 'admin' && !is_active) {
        return res.status(403).json({ error: 'Akun administrator utama tidak dapat dinonaktifkan' });
      }
      updateFields += ', is_active = ?';
      params.push(is_active ? 1 : 0);
    }

    if (password && password.trim() !== '') {
      updateFields += ', password = ?';
      params.push(password);
    }

    updateFields += ' WHERE id = ?';
    params.push(id);

    await pool.query(`UPDATE users SET ${updateFields}`, params);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memperbarui pengguna' });
  }
});

app.delete('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username wajib disertakan' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE LOWER(username) = ?', [username.trim().toLowerCase()]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    }
    const user = userRows[0];

    if (user.username === 'admin') {
      return res.status(403).json({ error: 'Akun administrator utama tidak dapat dihapus' });
    }

    // Delete related attendance records
    await pool.query('DELETE FROM absensi WHERE user_id = ?', [user.id]);
    // Delete the user record
    await pool.query('DELETE FROM users WHERE id = ?', [user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus pengguna dari database' });
  }
});

// 5. QR GET & POST
app.get('/api/qr', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM qr_token LIMIT 1');
    if (rows.length === 0) {
      return res.json({ token: 'ABSENSI-KANTOR-PENGESAHAN-TOKEN-2026' });
    }
    res.json({ token: rows[0].token });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat token QR' });
  }
});

app.post('/api/qr', async (req, res) => {
  try {
    const { token } = req.body;
    const newToken = token?.trim() || `QR-ABSENSI-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    await pool.query(
      `INSERT INTO qr_token (id, token, created_at, is_active) VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE token = ?, created_at = ?, is_active = ?`,
      ['qr-default', newToken, new Date(), 1, newToken, new Date(), 1]
    );

    res.json({ success: true, token: newToken });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memperbarui token QR' });
  }
});

// 6. Settings GET & POST
app.get('/api/settings', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT key_name, key_value FROM settings");
    const settings = {
      deadline_time: '08:30',
      office_latitude: '',
      office_longitude: '',
      telegram_bot_token: '',
      telegram_chat_id: '',
    };
    rows.forEach(row => {
      settings[row.key_name] = row.key_value;
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat pengaturan' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { deadline_time, office_latitude, office_longitude, telegram_bot_token, telegram_chat_id } = req.body;
    
    if (deadline_time) {
      if (!/^\d{2}:\d{2}$/.test(deadline_time)) {
        return res.status(400).json({ error: 'Format jam deadline tidak valid (HH:MM)' });
      }
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('deadline_time', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [deadline_time, deadline_time]
      );
    }
    
    if (office_latitude !== undefined && office_longitude !== undefined) {
      const latVal = office_latitude?.toString().trim();
      const lngVal = office_longitude?.toString().trim();
      
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('office_latitude', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [latVal, latVal]
      );
      
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('office_longitude', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [lngVal, lngVal]
      );
    }

    if (telegram_bot_token !== undefined) {
      const tokenVal = telegram_bot_token.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('telegram_bot_token', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [tokenVal, tokenVal]
      );
    }

    if (telegram_chat_id !== undefined) {
      let chatIdVal = telegram_chat_id.toString().trim();
      if (chatIdVal.startsWith('-') && !chatIdVal.startsWith('-100')) {
        chatIdVal = '-100' + chatIdVal.slice(1);
      }
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('telegram_chat_id', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [chatIdVal, chatIdVal]
      );
    }

    res.json({ success: true, settings: { deadline_time, office_latitude, office_longitude, telegram_bot_token, telegram_chat_id } });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan pengaturan' });
  }
});

// 7. Change Password
app.post('/api/users/change-password', async (req, res) => {
  try {
    const { user_id, new_password } = req.body;
    if (!user_id || !new_password) {
      return res.status(400).json({ error: 'User ID dan password baru wajib diisi' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    await pool.query('UPDATE users SET password = ? WHERE id = ?', [new_password, user_id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengganti password' });
  }
});

// 7.5 Reset Device
app.post('/api/users/reset-device', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username wajib disertakan' });
    }

    await pool.query(
      'UPDATE users SET device_id = NULL, device_info = NULL WHERE LOWER(username) = ?',
      [username.trim().toLowerCase()]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mereset perangkat pengguna' });
  }
});

// 8. Update Profile Photo
app.post('/api/users/update-profile', async (req, res) => {
  try {
    const { user_id, foto_base64 } = req.body;
    if (!user_id || !foto_base64) {
      return res.status(400).json({ error: 'Data update tidak lengkap' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const user = userRows[0];

    let fotoUrl = '/uploads/placeholder.jpg';
    if (foto_base64.startsWith('data:image')) {
      try {
        const matches = foto_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const extension = matches[1].split('/')[1] || 'jpg';
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `profile-${user.username}-${Date.now()}.${extension}`;
          const filepath = path.join(uploadDir, filename);

          fs.writeFileSync(filepath, buffer);
          fotoUrl = `/uploads/${filename}`;
        }
      } catch (err) {
        console.error('Gagal menyimpan foto profil:', err);
        return res.status(500).json({ error: 'Gagal menyimpan file foto' });
      }
    } else {
      return res.status(400).json({ error: 'Format foto tidak valid' });
    }

    await pool.query('UPDATE users SET foto_profile = ? WHERE id = ?', [fotoUrl, user_id]);
    res.json({ success: true, foto_profile: fotoUrl });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memperbarui foto profil' });
  }
});

if (process.env.VERCEL) {
  initDb().catch(err => console.error("Gagal melakukan inisialisasi basis data PostgreSQL di Vercel:", err));
} else {
  app.listen(PORT, () => {
    console.log(`Server Express backend berjalan pada http://localhost:${PORT}`);
  });
}

module.exports = app;
