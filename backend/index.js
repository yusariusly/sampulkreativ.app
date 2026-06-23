const express = require('express');
const mysql = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
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

async function sendAttendanceEmail({ senderName, status, reason, filePath, fileName, fileBuffer }) {
  // Query settings from DB using raw pgPool since pool is not hoisted yet
  let host = process.env.SMTP_HOST;
  let port = process.env.SMTP_PORT || 587;
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;
  let to = process.env.SMTP_TO;
  let senderEmail = process.env.SMTP_SENDER || '';

  try {
    const res = await pgPool.query("SELECT key_name, key_value FROM settings WHERE key_name IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_to', 'smtp_sender')");
    res.rows.forEach(row => {
      if (row.key_name === 'smtp_host' && row.key_value.trim() !== '') host = row.key_value;
      if (row.key_name === 'smtp_port' && row.key_value.trim() !== '') port = row.key_value;
      if (row.key_name === 'smtp_user' && row.key_value.trim() !== '') user = row.key_value;
      if (row.key_name === 'smtp_pass' && row.key_value.trim() !== '') pass = row.key_value;
      if (row.key_name === 'smtp_to' && row.key_value.trim() !== '') to = row.key_value;
      if (row.key_name === 'smtp_sender' && row.key_value.trim() !== '') senderEmail = row.key_value;
    });
  } catch (err) {
    console.error("Gagal memuat SMTP dari settings database, menggunakan env:", err);
  }

  const finalSender = senderEmail || user;

  if (!host || !user || !pass || !to) {
    console.warn("⚠️ SMTP Credentials are not configured in settings/env. Email logging fallback:");
    console.log(`[Email Sent Mock]
To: ${to || 'Admin'}
From: ${senderName} <${finalSender || 'system@absensi.com'}>
Subject: Pengajuan ${status} - ${senderName}
Body: Saya izin ${status.toLowerCase()} ${status === 'Sakit' ? 'karena sakit' : `dengan alasan: ${reason}`}. Berikut terlampir buktinya.
Attachment: ${filePath || 'None'}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: parseInt(port) === 465,
    auth: {
      user,
      pass,
    },
  });

  const formattedDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const subject = `[Pengajuan ${status}] ${senderName} - ${formattedDate}`;
  let text = '';
  
  if (status === 'Sakit') {
    text = `Yth. HRD / Administrator,

Dengan hormat,

Melalui email ini, saya mengajukan permohonan izin ketidakhadiran kerja karena sakit pada hari ini, ${formattedDate}.

Sebagai bukti pendukung, saya melampirkan foto surat keterangan sakit dari dokter bersama email ini.

Atas perhatian Bapak/Ibu, saya ucapkan terima kasih.

Hormat saya,
${senderName}`;
  } else {
    text = `Yth. HRD / Administrator,

Dengan hormat,

Melalui email ini, saya mengajukan permohonan izin ketidakhadiran kerja pada hari ini, ${formattedDate}, dengan alasan/keperluan sebagai berikut:

"${reason}"

Sebagai bukti pendukung, saya melampirkan foto/dokumen pendukung bersama email ini.

Atas perhatian dan izin yang diberikan Bapak/Ibu, saya ucapkan terima kasih.

Hormat saya,
${senderName}`;
  }

  const attachments = [];
  if (fileBuffer) {
    attachments.push({
      filename: fileName || 'lampiran.jpg',
      content: fileBuffer,
    });
  } else if (filePath && fs.existsSync(filePath)) {
    attachments.push({
      filename: fileName || 'lampiran.jpg',
      path: filePath,
    });
  }

  const mailOptions = {
    from: `"${senderName}" <${finalSender}>`,
    to,
    subject,
    text,
    attachments,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Email pengajuan ${status} berhasil dikirim ke ${to}`);
}

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
        foto_profile TEXT DEFAULT '/uploads/placeholder.jpg',
        tanggal_lahir VARCHAR(20) NULL,
        gender VARCHAR(20) NULL,
        alamat TEXT NULL
      )
    `);

    // Migration to add column if table exists without it
    try {
      await pool.query("ALTER TABLE users ADD COLUMN foto_profile TEXT DEFAULT '/uploads/placeholder.jpg'");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    // Force column type conversion to TEXT for existing VARCHAR columns
    try {
      await pool.query("ALTER TABLE users ALTER COLUMN foto_profile TYPE TEXT");
    } catch (err) {
      // Ignore type conversion errors
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

    try {
      await pool.query("ALTER TABLE users ADD COLUMN tanggal_lahir VARCHAR(20) NULL");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN alamat TEXT NULL");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payroll_config (
        user_id VARCHAR(50) PRIMARY KEY,
        gaji_pokok DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        tunjangan_makan DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        tunjangan_transport DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        potongan_alpha DECIMAL(12, 2) NOT NULL DEFAULT 0.00
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payroll_slips (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        username VARCHAR(50) NOT NULL,
        nama_lengkap VARCHAR(100) NOT NULL,
        periode VARCHAR(20) NOT NULL,
        slip_no VARCHAR(50) NOT NULL UNIQUE,
        tanggal_cetak VARCHAR(50) NOT NULL,
        hari_kantor INTEGER NOT NULL,
        hari_remote INTEGER NOT NULL,
        hari_sakit INTEGER NOT NULL,
        hari_izin INTEGER NOT NULL,
        hari_alpha INTEGER NOT NULL,
        gaji_pokok DECIMAL(12, 2) NOT NULL,
        tunjangan_makan DECIMAL(12, 2) NOT NULL,
        tunjangan_transport DECIMAL(12, 2) NOT NULL,
        potongan_alpha DECIMAL(12, 2) NOT NULL,
        potongan_sakit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        potongan_izin DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        total_pendapatan DECIMAL(12, 2) NOT NULL,
        total_potongan DECIMAL(12, 2) NOT NULL,
        gaji_bersih DECIMAL(12, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Dibayar',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await pool.query("ALTER TABLE payroll_config ADD COLUMN jabatan VARCHAR(100) DEFAULT 'Karyawan'");
    } catch (err) {}

    try {
      await pool.query("ALTER TABLE payroll_slips ADD COLUMN jabatan VARCHAR(100) DEFAULT 'Karyawan'");
    } catch (err) {}

    try {
      await pool.query("ALTER TABLE payroll_config ADD COLUMN bonus DECIMAL(12, 2) DEFAULT 0.00");
    } catch (err) {}

    try {
      await pool.query("ALTER TABLE payroll_slips ADD COLUMN bonus DECIMAL(12, 2) DEFAULT 0.00");
    } catch (err) {}

    // 2. Seed admin user if no users exist
    const [userRows] = await pool.query("SELECT COUNT(*) as cnt FROM users");
    if (userRows[0].cnt === 0) {
      await pool.query(`
        INSERT INTO users (id, username, password, nama_lengkap, role, is_active, foto_profile) VALUES
        ('usr-admin', 'admin', 'admin', 'Administrator', 'admin', 1, '/uploads/placeholder.jpg')
      `);
    }

    // 3. Seed default settings if empty
    const [settingRows] = await pool.query("SELECT COUNT(*) as cnt FROM settings");
    if (settingRows[0].cnt === 0) {
      await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('deadline_time', '08:30')");
    }
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('checkout_time', '17:00') ON DUPLICATE KEY UPDATE key_value = key_value");
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('telegram_bot_token', '') ON DUPLICATE KEY UPDATE key_value = key_value");
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('telegram_chat_id', '') ON DUPLICATE KEY UPDATE key_value = key_value");
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('smtp_host', '') ON DUPLICATE KEY UPDATE key_value = key_value");
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('smtp_port', '587') ON DUPLICATE KEY UPDATE key_value = key_value");
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('smtp_user', '') ON DUPLICATE KEY UPDATE key_value = key_value");
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('smtp_pass', '') ON DUPLICATE KEY UPDATE key_value = key_value");
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('smtp_to', '') ON DUPLICATE KEY UPDATE key_value = key_value");
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('smtp_sender', '') ON DUPLICATE KEY UPDATE key_value = key_value");

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
      foto_profile: user.foto_profile || '/uploads/placeholder.jpg',
      tanggal_lahir: user.tanggal_lahir || '',
      gender: user.gender || '',
      alamat: user.alamat || ''
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
        [userId, trimmedUsername, 'no_password', trimmedNama, 'user', 0, '/uploads/placeholder.jpg', device_id, device_info]
      );
      user = {
        id: userId,
        username: trimmedUsername,
        nama_lengkap: trimmedNama,
        role: 'user',
        is_active: 0,
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
      is_active: user.is_active,
      foto_profile: user.foto_profile || '/uploads/placeholder.jpg',
      device_id: user.device_id,
      device_info: user.device_info,
      tanggal_lahir: user.tanggal_lahir || '',
      gender: user.gender || '',
      alamat: user.alamat || ''
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
      'SELECT id, username, nama_lengkap, role, is_active, foto_profile, device_id, device_info, tanggal_lahir, gender, alamat FROM users WHERE device_id = ? LIMIT 1',
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
        is_active: user.is_active,
        foto_profile: user.foto_profile || '/uploads/placeholder.jpg',
        device_id: user.device_id,
        device_info: user.device_info,
        tanggal_lahir: user.tanggal_lahir || '',
        gender: user.gender || '',
        alamat: user.alamat || ''
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mencocokkan perangkat' });
  }
});

const fillAlpaForUser = async (userId) => {
  try {
    const [userRows] = await pool.query('SELECT username, nama_lengkap, created_at FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) return;
    const user = userRows[0];

    const signupDate = user.created_at ? new Date(user.created_at) : new Date();
    signupDate.setHours(0, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    if (signupDate.getTime() > yesterday.getTime()) {
      return;
    }

    const [attnRows] = await pool.query('SELECT waktu_absen FROM absensi WHERE user_id = ?', [userId]);
    const existingDates = new Set(
      attnRows.map(row => {
        const d = new Date(row.waktu_absen);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    );

    let current = new Date(signupDate);
    while (current.getTime() <= yesterday.getTime()) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      
      if (!existingDates.has(dateStr)) {
        const recordId = `alpa-${userId}-${dateStr}`;
        const waktuAbsen = new Date(current);
        waktuAbsen.setHours(9, 0, 0, 0);

        await pool.query(
          `INSERT INTO absensi (id, user_id, username, nama_lengkap, waktu_absen, foto_url, latitude, longitude, status, diubah_oleh_admin) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
          [
            recordId,
            userId,
            user.username,
            user.nama_lengkap,
            waktuAbsen,
            'placeholder',
            null,
            null,
            'Alpa',
            0
          ]
        );
      }
      current.setDate(current.getDate() + 1);
    }
  } catch (err) {
    console.error(`Gagal mengisi Alpa untuk user ${userId}:`, err);
  }
};

// 2. Attendance GET & POST
app.get('/api/attendance', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (user_id) {
      await fillAlpaForUser(user_id);
    } else {
      const [users] = await pool.query("SELECT id FROM users WHERE role = 'user' AND is_active = 1");
      for (const u of users) {
        await fillAlpaForUser(u.id);
      }
    }

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
      `👤 Nama: ${newRecord.nama_lengkap}\n` +
      `⏰ Waktu: ${formattedTime}\n` +
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
    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Akses ditolak: Akun Anda belum disetujui atau dinonaktifkan oleh administrator.' });
    }

    // Device Verification: Ensure the device matches registered device (only if device_id is set)
    if (user.role === 'user' && user.device_id && user.device_id.trim() !== '') {
      const { device_id } = req.body;
      if (!device_id || device_id !== user.device_id) {
        return res.status(403).json({ 
          error: 'Akses ditolak: Absensi harus dilakukan dari handphone yang terdaftar untuk akun ini.' 
        });
      }
    }

    // Distance/Coordinate verification (only if status is Hadir or Pulang)
    if (status === 'Hadir' || status === 'Pulang') {
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
        if (distance > 30) {
          return res.status(400).json({ 
            error: `Jarak Anda terlalu jauh (${Math.round(distance)} meter dari kantor). Maksimal diperbolehkan: 30 meter.` 
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

          if (hasTelegram && status !== 'Sakit' && status !== 'Izin') {
            // Telegram is configured: do NOT save to local storage
            fotoUrl = 'telegram';
          } else {
            // Fallback to local storage
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

    // Send email for Sakit/Izin
    if (status === 'Sakit' || status === 'Izin') {
      const reason = req.body.reason || '';
      const localFilePath = fileBuffer ? path.join(uploadDir, filename) : null;
      sendAttendanceEmail({
        senderName: user.nama_lengkap,
        status: status,
        reason: reason,
        filePath: localFilePath,
        fileName: filename,
        fileBuffer: fileBuffer
      }).catch(err => console.error("Gagal mengirim email absensi:", err));
    }

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
    const [rows] = await pool.query('SELECT id, username, nama_lengkap, role, is_active, foto_profile, device_id, device_info, tanggal_lahir, gender, alamat FROM users');
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
    const { id, nama_lengkap, username, password, is_active } = req.body;
    if (!id || !nama_lengkap || !username) {
      return res.status(400).json({ error: 'Data update tidak lengkap' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const user = userRows[0];

    // Role is permanently locked after account creation — cannot be changed
    const [dupRows] = await pool.query('SELECT * FROM users WHERE id != ? AND LOWER(username) = ?', [id, username.trim().toLowerCase()]);
    if (dupRows.length > 0) {
      return res.status(400).json({ error: 'Username/nomor HP sudah digunakan oleh akun lain' });
    }

    let updateFields = 'nama_lengkap = ?, username = ?';
    let params = [nama_lengkap.trim(), username.trim().toLowerCase()];

    if (is_active !== undefined) {
      if (user.username === 'admin' && !is_active) {
        return res.status(403).json({ error: 'Akun administrator utama tidak dapat dinonaktifkan' });
      }
      updateFields += ', is_active = ?';
      params.push(is_active ? 1 : 0);
    }

    if (password && password.trim() !== '' && password !== 'no_password') {
      updateFields += ', password = ?';
      params.push(password);
    }

    params.push(id);

    await pool.query(`UPDATE users SET ${updateFields} WHERE id = ?`, params);
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

    // Delete the user record (keep attendance records intact as requested)
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
      checkout_time: '17:00',
      office_latitude: '',
      office_longitude: '',
      telegram_bot_token: '',
      telegram_chat_id: '',
      smtp_host: '',
      smtp_port: '587',
      smtp_user: '',
      smtp_pass: '',
      smtp_to: '',
      smtp_sender: '',
      payroll_approver_name: 'M. Firas Faisal',
      payroll_approver_role: 'Direktur Utama',
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
    const { 
      deadline_time, 
      checkout_time, 
      office_latitude, 
      office_longitude, 
      telegram_bot_token, 
      telegram_chat_id,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      smtp_to,
      smtp_sender,
      payroll_approver_name,
      payroll_approver_role
    } = req.body;
    
    if (deadline_time) {
      if (!/^\d{2}:\d{2}$/.test(deadline_time)) {
        return res.status(400).json({ error: 'Format jam deadline tidak valid (HH:MM)' });
      }
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('deadline_time', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [deadline_time, deadline_time]
      );
    }

    if (checkout_time) {
      if (!/^\d{2}:\d{2}$/.test(checkout_time)) {
        return res.status(400).json({ error: 'Format jam pulang tidak valid (HH:MM)' });
      }
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('checkout_time', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [checkout_time, checkout_time]
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

    if (smtp_host !== undefined) {
      const val = smtp_host.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('smtp_host', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (smtp_port !== undefined) {
      const val = smtp_port.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('smtp_port', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (smtp_user !== undefined) {
      const val = smtp_user.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('smtp_user', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (smtp_pass !== undefined) {
      const val = smtp_pass.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('smtp_pass', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (smtp_to !== undefined) {
      const val = smtp_to.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('smtp_to', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (smtp_sender !== undefined) {
      const val = smtp_sender.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('smtp_sender', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (payroll_approver_name !== undefined) {
      const val = payroll_approver_name.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('payroll_approver_name', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (payroll_approver_role !== undefined) {
      const val = payroll_approver_role.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('payroll_approver_role', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    res.json({ 
      success: true, 
      settings: { 
        deadline_time, 
        checkout_time, 
        office_latitude, 
        office_longitude, 
        telegram_bot_token, 
        telegram_chat_id,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_pass,
        smtp_to,
        payroll_approver_name,
        payroll_approver_role
      } 
    });
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

// 7.6 Approve User
app.post('/api/users/approve', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username wajib disertakan' });
    }

    await pool.query(
      'UPDATE users SET is_active = 1 WHERE LOWER(username) = ?',
      [username.trim().toLowerCase()]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyetujui pengguna' });
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

    if (!foto_base64.startsWith('data:image')) {
      return res.status(400).json({ error: 'Format foto tidak valid' });
    }

    // Save base64 string directly in Supabase PostgreSQL
    await pool.query('UPDATE users SET foto_profile = ? WHERE id = ?', [foto_base64, user_id]);
    res.json({ success: true, foto_profile: foto_base64 });
  } catch (error) {
    console.error('Gagal memperbarui foto profil:', error);
    res.status(500).json({ error: 'Gagal memperbarui foto profil' });
  }
});

// 9. Update Bio Data
app.post('/api/users/update-bio', async (req, res) => {
  try {
    const { user_id, tanggal_lahir, gender, alamat } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID wajib disertakan' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    await pool.query(
      'UPDATE users SET tanggal_lahir = ?, gender = ?, alamat = ? WHERE id = ?',
      [tanggal_lahir || null, gender || null, alamat || null, user_id]
    );

    // Fetch updated user to return
    const [updatedRows] = await pool.query(
      'SELECT id, username, nama_lengkap, role, is_active, foto_profile, device_id, device_info, tanggal_lahir, gender, alamat FROM users WHERE id = ?',
      [user_id]
    );
    const updatedUser = updatedRows[0];

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Gagal memperbarui biodata:', error);
    res.status(500).json({ error: 'Gagal memperbarui biodata' });
  }
});

// ==========================================
// 10. PAYROLL MANAGEMENT ENDPOINTS
// ==========================================

// Get all payroll configs (Admin settings list)
app.get('/api/payroll/config', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.id as user_id, 
        u.username, 
        u.nama_lengkap, 
        u.role, 
        COALESCE(c.gaji_pokok, 0.00) as gaji_pokok, 
        COALESCE(c.tunjangan_makan, 0.00) as tunjangan_makan, 
        COALESCE(c.tunjangan_transport, 0.00) as tunjangan_transport, 
        COALESCE(c.potongan_alpha, 0.00) as potongan_alpha,
        COALESCE(c.jabatan, 'Karyawan') as jabatan,
        COALESCE(c.bonus, 0.00) as bonus
      FROM users u 
      LEFT JOIN payroll_config c ON u.id = c.user_id 
      WHERE u.role = 'user' AND u.is_active = 1
    `);
    res.json(rows);
  } catch (error) {
    console.error('Gagal mengambil konfigurasi payroll:', error);
    res.status(500).json({ error: 'Gagal mengambil konfigurasi payroll' });
  }
});

// Create or update payroll config
app.post('/api/payroll/config', async (req, res) => {
  try {
    const { user_id, gaji_pokok, tunjangan_makan, tunjangan_transport, potongan_alpha, jabatan, bonus } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID wajib disertakan' });
    }

    await pool.query(`
      INSERT INTO payroll_config (user_id, gaji_pokok, tunjangan_makan, tunjangan_transport, potongan_alpha, jabatan, bonus)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET
        gaji_pokok = EXCLUDED.gaji_pokok,
        tunjangan_makan = EXCLUDED.tunjangan_makan,
        tunjangan_transport = EXCLUDED.tunjangan_transport,
        potongan_alpha = EXCLUDED.potongan_alpha,
        jabatan = EXCLUDED.jabatan,
        bonus = EXCLUDED.bonus
    `, [user_id, gaji_pokok || 0, tunjangan_makan || 0, tunjangan_transport || 0, potongan_alpha || 0, jabatan || 'Karyawan', bonus || 0]);

    res.json({ success: true, message: 'Konfigurasi payroll berhasil disimpan' });
  } catch (error) {
    console.error('Gagal menyimpan konfigurasi payroll:', error);
    res.status(500).json({ error: 'Gagal menyimpan konfigurasi payroll' });
  }
});

// Get payroll slips (can filter by user_id)
app.get('/api/payroll/slips', async (req, res) => {
  try {
    const { user_id } = req.query;
    let query = 'SELECT * FROM payroll_slips';
    const params = [];

    if (user_id) {
      query += ' WHERE user_id = ?';
      params.push(user_id);
    }
    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    
    // Convert string decimals to numbers
    const mapped = rows.map(s => ({
      ...s,
      gaji_pokok: Number(s.gaji_pokok),
      tunjangan_makan: Number(s.tunjangan_makan),
      tunjangan_transport: Number(s.tunjangan_transport),
      potongan_alpha: Number(s.potongan_alpha),
      potongan_sakit: Number(s.potongan_sakit),
      potongan_izin: Number(s.potongan_izin),
      total_pendapatan: Number(s.total_pendapatan),
      total_potongan: Number(s.total_potongan),
      gaji_bersih: Number(s.gaji_bersih),
      bonus: Number(s.bonus || 0)
    }));

    res.json(mapped);
  } catch (error) {
    console.error('Gagal mengambil data slip gaji:', error);
    res.status(500).json({ error: 'Gagal mengambil data slip gaji' });
  }
});

// Create/Generate payroll slip
app.post('/api/payroll/slips', async (req, res) => {
  try {
    const {
      user_id,
      periode,
      slip_no,
      tanggal_cetak,
      hari_kantor,
      hari_remote,
      hari_sakit,
      hari_izin,
      hari_alpha,
      gaji_pokok,
      tunjangan_makan,
      tunjangan_transport,
      potongan_alpha,
      potongan_sakit,
      potongan_izin,
      total_pendapatan,
      total_potongan,
      gaji_bersih,
      status,
      bonus
    } = req.body;

    if (!user_id || !periode || !slip_no) {
      return res.status(400).json({ error: 'User ID, Periode, dan Slip No wajib disertakan' });
    }

    // Get user details
    const [userRows] = await pool.query('SELECT username, nama_lengkap FROM users WHERE id = ?', [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const { username, nama_lengkap } = userRows[0];

    // Get user's jabatan
    const [configRows] = await pool.query('SELECT COALESCE(jabatan, \'Karyawan\') as jabatan FROM payroll_config WHERE user_id = ?', [user_id]);
    const jabatan = configRows.length > 0 ? configRows[0].jabatan : 'Karyawan';

    const slipId = `slip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await pool.query(`
      INSERT INTO payroll_slips (
        id, user_id, username, nama_lengkap, periode, slip_no, tanggal_cetak,
        hari_kantor, hari_remote, hari_sakit, hari_izin, hari_alpha,
        gaji_pokok, tunjangan_makan, tunjangan_transport, potongan_alpha,
        potongan_sakit, potongan_izin, total_pendapatan, total_potongan, gaji_bersih, status, jabatan, bonus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      slipId, user_id, username, nama_lengkap, periode, slip_no, tanggal_cetak,
      hari_kantor || 0, hari_remote || 0, hari_sakit || 0, hari_izin || 0, hari_alpha || 0,
      gaji_pokok || 0, tunjangan_makan || 0, tunjangan_transport || 0, potongan_alpha || 0,
      potongan_sakit || 0, potongan_izin || 0, total_pendapatan || 0, total_potongan || 0, gaji_bersih || 0,
      status || 'Dibayar', jabatan, bonus || 0
    ]);

    res.json({ success: true, message: 'Slip gaji berhasil digenerate', id: slipId });
  } catch (error) {
    console.error('Gagal membuat slip gaji:', error);
    res.status(500).json({ error: 'Gagal membuat slip gaji' });
  }
});


if (process.env.VERCEL) {
  initDb().catch(err => console.error("Gagal melakukan inisialisasi basis data PostgreSQL di Vercel:", err));
} else {
  app.listen(PORT, () => {
    console.log(`Server Express backend berjalan pada http://localhost:${PORT}`);
    initDb().catch(err => console.error("Gagal melakukan inisialisasi basis data:", err));
  });
}

module.exports = app;
