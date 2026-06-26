const express = require('express');
const mysql = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("⚠️ Warning: SUPABASE_URL atau SUPABASE_KEY belum dikonfigurasi di .env");
}

const remoteService = require('./services/remoteService');
const REMOTE_STATUS = remoteService.REMOTE_STATUS;

// Generic upload file helper
async function uploadFileToSupabase(base64String, bucketName, filePrefix, allowedMimes, maxSizeInBytes) {
  if (!supabase) {
    throw new Error('Supabase client belum diinisialisasi. Silakan periksa file .env Anda.');
  }

  const matches = base64String.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Format base64 berkas tidak valid.');
  }

  const contentType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length > maxSizeInBytes) {
    throw new Error(`Ukuran berkas melebihi batas maksimal (${(maxSizeInBytes / (1024 * 1024)).toFixed(0)}MB).`);
  }

  if (!allowedMimes.includes(contentType)) {
    throw new Error('Format tipe berkas tidak diizinkan.');
  }

  let extension = contentType.split('/')[1] || 'jpg';
  if (extension === 'jpeg') extension = 'jpg';

  const fileName = `${filePrefix}-${Date.now()}.${extension}`;

  let uploadResult = await supabase.storage
    .from(bucketName)
    .upload(fileName, buffer, {
      contentType,
      upsert: true
    });

  if (uploadResult.error && (uploadResult.error.message.includes('not found') || uploadResult.error.message.toLowerCase().includes('bucket'))) {
    // Attempt to create bucket dynamically
    try {
      const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true });
      if (!createError) {
        uploadResult = await supabase.storage
          .from(bucketName)
          .upload(fileName, buffer, {
            contentType,
            upsert: true
          });
      }
    } catch (createBucketErr) {
      console.error("Gagal membuat bucket Supabase secara otomatis:", createBucketErr);
    }
  }

  if (uploadResult.error) throw uploadResult.error;

  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return publicUrl;
}

// Helper untuk unggah foto ke Supabase Storage (re-routed to use general helper)
async function uploadToSupabase(base64String, userId) {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  return uploadFileToSupabase(base64String, 'profile-photos', `avatar-${userId}`, allowedMimes, maxSize);
}

// Helper untuk hapus file foto profil lama dari Supabase Storage
async function deleteFromSupabase(photoUrl) {
  if (!supabase || !photoUrl) return;

  try {
    const prefix = `${supabaseUrl}/storage/v1/object/public/profile-photos/`;
    if (photoUrl.startsWith(prefix)) {
      const fileName = photoUrl.replace(prefix, '');
      if (fileName) {
        const { error } = await supabase.storage
          .from('profile-photos')
          .remove([fileName]);
        if (error) {
          console.error('Gagal menghapus file lama dari Supabase:', error);
        } else {
          console.log(`Berhasil menghapus file lama dari Supabase: ${fileName}`);
        }
      }
    }
  } catch (e) {
    console.error('Error saat mencoba menghapus file dari Supabase:', e);
  }
}

// Helper to generate employee number (yyyymmdd0200)
async function generateNoKaryawan() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `${yyyy}${mm}${dd}02`;

  const [rows] = await pool.query(
    "SELECT COUNT(*) as count FROM users WHERE no_karyawan LIKE ?",
    [`${prefix}%`]
  );
  
  const count = rows[0]?.count || 0;
  const suffix = String(count).padStart(2, '0');
  
  return `${prefix}${suffix}`;
}

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

async function sendRemoteApprovalEmail({ employeeName, rawToken, alasan, date, frontendUrl }) {
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
  const finalFrontendUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const approvalLink = `${finalFrontendUrl}/remote-approval?token=${rawToken}`;

  if (!host || !user || !pass || !to) {
    console.warn("⚠️ SMTP Credentials are not configured. Email approval link fallback:");
    console.log(`[Email Approval Link Mock] To: ${to || 'Admin'}, Link: ${approvalLink}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: parseInt(port) === 465,
    auth: { user, pass },
  });

  const mailOptions = {
    from: `"SampulKreativ System" <${finalSender}>`,
    to,
    subject: `[Pengajuan WFH] ${employeeName} - ${date}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Permohonan Kerja Jarak Jauh (Remote Working / WFH)</h2>
        <p>Halo Administrator / Atasan,</p>
        <p>Karyawan berikut mengajukan permohonan Remote Working:</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 150px;">Nama Karyawan</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${employeeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tanggal Kerja</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${date}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Alasan</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${alasan}</td>
          </tr>
        </table>
        <p>Silakan klik tautan di bawah ini untuk memproses persetujuan:</p>
        <a href="${approvalLink}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Tinjau Pengajuan</a>
        <br/><br/>
        <p>Atau buka tautan berikut secara manual:</p>
        <p>${approvalLink}</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

async function sendDailyReportEmail({ employeeName, reportContent, attachmentUrl, date }) {
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
    console.warn("⚠️ SMTP Credentials are not configured. Email report fallback:");
    console.log(`[Email Report Mock] To: ${to || 'Admin'}, Content: ${reportContent}, Attachment: ${attachmentUrl}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: parseInt(port) === 465,
    auth: { user, pass },
  });

  const mailOptions = {
    from: `"SampulKreativ System" <${finalSender}>`,
    to,
    subject: `[Daily Report WFH] ${employeeName} - ${date}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Laporan Kerja Harian (Daily Report WFH)</h2>
        <p>Halo Administrator / Atasan,</p>
        <p>Berikut adalah laporan kerja harian yang disubmit oleh:</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 150px;">Nama Karyawan</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${employeeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tanggal Kerja</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${date}</td>
          </tr>
        </table>
        <div style="background-color: #F3F4F6; padding: 15px; border-radius: 5px; margin-bottom: 20px; white-space: pre-wrap;">
          ${reportContent}
        </div>
        ${attachmentUrl ? `<p><strong>Lampiran Berkas:</strong> <a href="${attachmentUrl}" target="_blank" style="color: #4F46E5; font-weight: bold;">Lihat Berkas Lampiran</a></p>` : '<p><em>Tidak ada lampiran berkas.</em></p>'}
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
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
    const hasPgPlaceholders = text.includes('$');
    pgText = pgText.replace(/\?/g, () => `$${paramIndex++}`);

    const finalParams = (params && !hasPgPlaceholders) ? params.slice(0, paramIndex - 1) : params;
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

    try {
      await pool.query("ALTER TABLE users ADD COLUMN jabatan VARCHAR(100) DEFAULT 'Karyawan'");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN email VARCHAR(150) NULL");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN no_telp VARCHAR(50) NULL");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN kategori VARCHAR(50) DEFAULT 'Karyawan'");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN no_karyawan VARCHAR(50) NULL");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    // Backfill no_karyawan for existing users
    try {
      // Normalize slashes from any existing no_karyawan entries
      try {
        await pool.query(
          "UPDATE users SET no_karyawan = REPLACE(no_karyawan, '/', '') WHERE no_karyawan LIKE '%/%'"
        );
      } catch (err) {
        console.error("Gagal menormalisasi format no_karyawan lama:", err);
      }

      const [emptyUsers] = await pool.query(
        "SELECT id, created_at FROM users WHERE role = 'user' AND (no_karyawan IS NULL OR no_karyawan = '') ORDER BY created_at ASC, id ASC"
      );
      for (const u of emptyUsers) {
        const joinDate = u.created_at ? new Date(u.created_at) : new Date();
        const yyyy = joinDate.getFullYear();
        const mm = String(joinDate.getMonth() + 1).padStart(2, '0');
        const dd = String(joinDate.getDate()).padStart(2, '0');
        const prefix = `${yyyy}${mm}${dd}02`;

        const [countRows] = await pool.query(
          "SELECT COUNT(*) as count FROM users WHERE no_karyawan LIKE ?",
          [`${prefix}%`]
        );
        const count = countRows[0]?.count || 0;
        const suffix = String(count).padStart(2, '0');
        const noKaryawan = `${prefix}${suffix}`;

        await pool.query(
          "UPDATE users SET no_karyawan = ? WHERE id = ?",
          [noKaryawan, u.id]
        );
      }
    } catch (err) {
      console.error("Gagal melakukan backfill no_karyawan:", err);
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

    // Migrate any existing 'pkl' roles to 'user'
    try {
      await pool.query("UPDATE users SET role = 'user' WHERE role = 'pkl'");
    } catch (err) {
      console.error("Gagal melakukan migrasi role pkl ke user:", err);
    }

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

    // 5. Create remote_requests table and indexes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS remote_requests (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tanggal DATE NOT NULL,
        alasan TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
        token_hash VARCHAR(64) NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        -- Audit Log
        action_by VARCHAR(100) NULL,
        action_at TIMESTAMPTZ NULL,
        expired_at TIMESTAMPTZ NULL CHECK (expired_at > action_at),
        
        -- Daily Report
        report_content TEXT NULL,
        report_attachment TEXT NULL,
        report_submitted_at TIMESTAMPTZ NULL,
        report_email_sent_at TIMESTAMPTZ NULL,
        report_email_failed TEXT NULL
      )
    `);

    try {
      await pool.query("CREATE INDEX IF NOT EXISTS idx_remote_requests_active ON remote_requests(user_id, status, expired_at)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_remote_requests_user_date ON remote_requests(user_id, tanggal)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_remote_requests_created_at ON remote_requests(created_at DESC)");
    } catch (indexErr) {
      console.warn("Gagal membuat index remote_requests:", indexErr);
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
      "SELECT * FROM users WHERE LOWER(username) = ? AND password = ? AND role = 'admin' AND is_active = 1",
      [username.trim().toLowerCase(), password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Username atau password salah' });
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
      alamat: user.alamat || '',
      jabatan: user.jabatan || 'Karyawan',
      email: user.email || '',
      no_telp: user.no_telp || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan internal server' });
  }
});

app.post('/api/auth/login-employee', async (req, res) => {
  try {
    const { username, password, device_id, device_info } = req.body;
    if (!username || !password || !device_id) {
      return res.status(400).json({ error: 'Username, password, dan perangkat wajib disertakan' });
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Find the user
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE LOWER(username) = ? AND role = 'user'",
      [trimmedUsername]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const user = rows[0];

    // Verify password
    if (user.password !== password) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    // Verify is_active
    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Username atau password salah' });
    }

    if (user.device_id && user.device_id.trim() !== '') {
      // If already bound to another device
      if (user.device_id !== device_id) {
        return res.status(403).json({
          error: 'Akun ini sudah terikat pada perangkat lain.'
        });
      }
    } else {
      // If not bound yet, bind it now!
      await pool.query(
        'UPDATE users SET device_id = ?, device_info = ? WHERE id = ?',
        [device_id, device_info, user.id]
      );
      user.device_id = device_id;
      user.device_info = device_info;
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
      alamat: user.alamat || '',
      jabatan: user.jabatan || 'Karyawan',
      email: user.email || '',
      no_telp: user.no_telp || '',
      kategori: user.kategori || 'Karyawan',
      no_karyawan: user.no_karyawan || ''
    });
  } catch (error) {
    console.error('Gagal melakukan login karyawan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan internal server' });
  }
});

app.post('/api/auth/register-device', async (req, res) => {
  try {
    const { nama_lengkap, username, device_id, device_info } = req.body;
    if (!nama_lengkap || !username || !device_id) {
      return res.status(400).json({ error: 'Nama Lengkap, Username, dan Perangkat wajib diisi' });
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

      if (user.device_id && user.device_id.trim() !== '' && user.device_id !== device_id) {
        return res.status(403).json({ 
          error: 'Akun ini sudah terikat pada perangkat lain.' 
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
      const noKaryawan = await generateNoKaryawan();
      await pool.query(
        'INSERT INTO users (id, username, password, nama_lengkap, role, is_active, foto_profile, device_id, device_info, no_karyawan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, trimmedUsername, 'no_password', trimmedNama, 'user', 0, '/uploads/placeholder.jpg', device_id, device_info, noKaryawan]
      );
      user = {
        id: userId,
        username: trimmedUsername,
        nama_lengkap: trimmedNama,
        role: 'user',
        is_active: 0,
        foto_profile: '/uploads/placeholder.jpg',
        device_id: device_id,
        device_info: device_info,
        no_karyawan: noKaryawan
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
      alamat: user.alamat || '',
      jabatan: user.jabatan || 'Karyawan',
      email: user.email || '',
      no_telp: user.no_telp || '',
      kategori: user.kategori || 'Karyawan',
      no_karyawan: user.no_karyawan || ''
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
      'SELECT id, username, nama_lengkap, role, is_active, foto_profile, device_id, device_info, tanggal_lahir, gender, alamat, jabatan, email, no_telp, kategori, no_karyawan FROM users WHERE device_id = ? LIMIT 1',
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
        alamat: user.alamat || '',
        jabatan: user.jabatan || 'Karyawan',
        email: user.email || '',
        no_telp: user.no_telp || '',
        kategori: user.kategori || 'Karyawan',
        no_karyawan: user.no_karyawan || ''
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
    const [chatIdPklSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_chat_id'");
    const [chatIdKaryawanSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_chat_id_karyawan'");
    
    const [userRows] = await pool.query("SELECT kategori FROM users WHERE id = ?", [newRecord.user_id]);
    const userKategori = userRows[0]?.kategori || 'Karyawan';
    
    const botToken = botTokenSetting[0]?.key_value;
    let chatId = '';
    if (userKategori === 'PKL') {
      chatId = chatIdPklSetting[0]?.key_value || '';
    } else {
      chatId = chatIdKaryawanSetting[0]?.key_value || chatIdPklSetting[0]?.key_value || '';
    }

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
    console.log(`[GPS_BACKEND_RECEIVED]\nUser: ${user_id}\nLatitude: ${latitude}\nLongitude: ${longitude}\nStatus: ${status}`);
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
    // Fetch WFH/Remote permission status using remoteService
    const wfhStatus = await remoteService.getTodayRemoteStatus(pool, user_id);
    const { permissions, remoteStatus } = wfhStatus;

    if (status === 'Hadir' || status === 'Terlambat') {
      if (!permissions.clockIn.allowed) {
        let errorMsg = 'Anda tidak diperbolehkan melakukan absensi masuk.';
        if (permissions.clockIn.reason === 'ALREADY_CLOCKED_IN') {
          errorMsg = 'Anda sudah melakukan absensi masuk hari ini.';
        } else if (permissions.clockIn.reason === 'ON_LEAVE') {
          errorMsg = 'Anda sedang dalam masa izin hari ini.';
        } else if (permissions.clockIn.reason === 'ON_SICK_LEAVE') {
          errorMsg = 'Anda sedang dalam masa sakit hari ini.';
        } else if (permissions.clockIn.reason === 'WFH_REQUEST_PENDING') {
          errorMsg = 'Anda tidak dapat melakukan absensi karena pengajuan Remote Working sedang menunggu persetujuan.';
        }
        return res.status(400).json({ error: errorMsg });
      }
    } else if (status === 'Pulang') {
      if (!permissions.clockOut.allowed) {
        let errorMsg = 'Anda tidak diperbolehkan melakukan absensi pulang.';
        if (permissions.clockOut.reason === 'NOT_CLOCKED_IN') {
          errorMsg = 'Anda belum melakukan absensi masuk hari ini.';
        } else if (permissions.clockOut.reason === 'ALREADY_CLOCKED_OUT') {
          errorMsg = 'Anda sudah melakukan absensi pulang hari ini.';
        } else if (permissions.clockOut.reason === 'USE_DAILY_REPORT') {
          errorMsg = 'Karyawan WFH wajib melakukan absensi pulang dengan mengirimkan Daily Report.';
        } else if (permissions.clockOut.reason === 'WFH_REQUEST_PENDING') {
          errorMsg = 'Pengajuan WFH sedang pending.';
        }
        return res.status(400).json({ error: errorMsg });
      }
    } else if (status === 'Izin') {
      if (!permissions.leave.allowed) {
        let errorMsg = 'Anda tidak diperbolehkan mengajukan izin hari ini.';
        if (permissions.leave.reason === 'WFH_REQUEST_PENDING') {
          errorMsg = 'Tidak dapat mengajukan izin karena pengajuan WFH Anda sedang menunggu persetujuan.';
        } else if (permissions.leave.reason === 'WFH_REQUEST_APPROVED') {
          errorMsg = 'Tidak dapat mengajukan izin karena pengajuan WFH Anda hari ini sudah disetujui.';
        } else if (permissions.leave.reason === 'ALREADY_CLOCKED_IN') {
          errorMsg = 'Anda sudah melakukan absen masuk hari ini.';
        } else if (permissions.leave.reason === 'ALREADY_ON_LEAVE') {
          errorMsg = 'Anda sudah mengajukan izin hari ini.';
        } else if (permissions.leave.reason === 'ALREADY_ON_SICK_LEAVE') {
          errorMsg = 'Anda sudah mengajukan sakit hari ini.';
        }
        return res.status(400).json({ error: errorMsg });
      }
    } else if (status === 'Sakit') {
      if (!permissions.sick.allowed) {
        let errorMsg = 'Anda tidak diperbolehkan mengajukan sakit hari ini.';
        if (permissions.sick.reason === 'WFH_REQUEST_PENDING') {
          errorMsg = 'Tidak dapat mengajukan sakit karena pengajuan WFH Anda sedang menunggu persetujuan.';
        } else if (permissions.sick.reason === 'WFH_REQUEST_APPROVED') {
          errorMsg = 'Tidak dapat mengajukan sakit karena pengajuan WFH Anda hari ini sudah disetujui.';
        } else if (permissions.sick.reason === 'ALREADY_CLOCKED_IN') {
          errorMsg = 'Anda sudah melakukan absen masuk hari ini.';
        } else if (permissions.sick.reason === 'ALREADY_ON_LEAVE') {
          errorMsg = 'Anda sudah mengajukan izin hari ini.';
        } else if (permissions.sick.reason === 'ALREADY_ON_SICK_LEAVE') {
          errorMsg = 'Anda sudah mengajukan sakit hari ini.';
        }
        return res.status(400).json({ error: errorMsg });
      }
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
      const officeLat = officeLatStr ? parseFloat(officeLatStr) : NaN;
      const officeLng = officeLngStr ? parseFloat(officeLngStr) : NaN;
      console.log(`[GPS_OFFICE_SETTINGS]\nofficeLatRaw: ${officeLatStr}\nofficeLngRaw: ${officeLngStr}\nofficeLat: ${officeLat}\nofficeLng: ${officeLng}`);
      
      if (officeLatStr && officeLngStr && officeLatStr.trim() !== '' && officeLngStr.trim() !== '') {
        if (!latitude || !longitude) {
          return res.status(400).json({ error: 'GPS perangkat wajib diaktifkan untuk melakukan absensi' });
        }

        const isWFHActive = remoteStatus === REMOTE_STATUS.APPROVED;

        if (!isWFHActive) {
          const distance = getDistanceInMeters(parseFloat(latitude), parseFloat(longitude), officeLat, officeLng);
          console.log(`[GPS_DISTANCE]\nUser Latitude: ${latitude}\nUser Longitude: ${longitude}\n\nOffice Latitude: ${officeLat}\nOffice Longitude: ${officeLng}\n\nDistance Result: ${distance}\nRadius Allowed: 30`);
          if (distance > 30) {
            return res.status(400).json({ 
              error: `Jarak Anda terlalu jauh (${Math.round(distance)} meter dari kantor). Maksimal diperbolehkan: 30 meter.` 
            });
          }
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
    const [rows] = await pool.query('SELECT id, username, nama_lengkap, role, is_active, foto_profile, device_id, device_info, tanggal_lahir, gender, alamat, jabatan, email, no_telp, kategori, no_karyawan FROM users');
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
    const { nama_lengkap, username, password, role, jabatan, email, no_telp } = req.body;
    if (!nama_lengkap || !username || !password || !role) {
      return res.status(400).json({ error: 'Data pengguna tidak lengkap' });
    }

    const [existRows] = await pool.query('SELECT * FROM users WHERE LOWER(username) = ?', [username.trim().toLowerCase()]);
    if (existRows.length > 0) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    let dbRole = 'user';
    const lowRole = role.toLowerCase();
    if (lowRole === 'admin') {
      dbRole = 'admin';
    }

    let noKaryawan = null;
    if (dbRole === 'user') {
      noKaryawan = await generateNoKaryawan();
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      username: username.trim().toLowerCase(),
      password: password,
      nama_lengkap: nama_lengkap.trim(),
      role: dbRole,
      is_active: 1,
      foto_profile: '/uploads/placeholder.jpg',
      jabatan: jabatan ? jabatan.trim() : 'Karyawan',
      email: email ? email.trim() : '',
      no_telp: no_telp ? no_telp.trim() : '',
      no_karyawan: noKaryawan
    };

    await pool.query(
      `INSERT INTO users (id, username, password, nama_lengkap, role, is_active, foto_profile, jabatan, email, no_telp, no_karyawan) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newUser.id, newUser.username, newUser.password, newUser.nama_lengkap, newUser.role, newUser.is_active, newUser.foto_profile, newUser.jabatan, newUser.email, newUser.no_telp, noKaryawan]
    );

    const { password: _, ...safeUser } = newUser;
    res.json({ success: true, user: { ...safeUser, is_active: true } });
  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat pengguna baru' });
  }
});

app.put('/api/users', async (req, res) => {
  try {
    const { id, nama_lengkap, username, password, is_active, role, jabatan, email, no_telp } = req.body;
    if (!id || !nama_lengkap || !username) {
      return res.status(400).json({ error: 'Data update tidak lengkap' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const user = userRows[0];

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

    if (role) {
      let dbRole = 'user';
      const lowRole = role.toLowerCase();
      if (lowRole === 'admin') {
        dbRole = 'admin';
      }
      updateFields += ', role = ?';
      params.push(dbRole);
    }

    if (jabatan !== undefined) {
      updateFields += ', jabatan = ?';
      params.push(jabatan.trim());
    }

    if (email !== undefined) {
      updateFields += ', email = ?';
      params.push(email.trim());
    }

    if (no_telp !== undefined) {
      updateFields += ', no_telp = ?';
      params.push(no_telp.trim());
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
      telegram_chat_id_karyawan: '',
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
      telegram_chat_id_karyawan,
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

    if (telegram_chat_id_karyawan !== undefined) {
      let chatIdVal = telegram_chat_id_karyawan.toString().trim();
      if (chatIdVal.startsWith('-') && !chatIdVal.startsWith('-100')) {
        chatIdVal = '-100' + chatIdVal.slice(1);
      }
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('telegram_chat_id_karyawan', ?) ON DUPLICATE KEY UPDATE key_value = ?",
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

    // 1. Hapus foto lama dari Supabase Storage jika ada
    const currentPhoto = userRows[0].foto_profile;
    if (currentPhoto) {
      await deleteFromSupabase(currentPhoto);
    }

    // 2. Unggah foto baru ke Supabase Storage
    const publicUrl = await uploadToSupabase(foto_base64, user_id);

    // 3. Simpan URL publik ke database
    await pool.query('UPDATE users SET foto_profile = ? WHERE id = ?', [publicUrl, user_id]);
    res.json({ success: true, foto_profile: publicUrl });
  } catch (error) {
    console.error('Gagal memperbarui foto profil:', error);
    res.status(500).json({ error: error.message || 'Gagal memperbarui foto profil' });
  }
});

// 9. Update Bio Data
app.post('/api/users/update-bio', async (req, res) => {
  try {
    const { user_id, tanggal_lahir, gender, alamat, jabatan, email, no_telp, kategori, password } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID wajib disertakan' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    let updateFields = 'tanggal_lahir = ?, gender = ?, alamat = ?';
    let params = [tanggal_lahir || null, gender || null, alamat || null];

    if (jabatan !== undefined) {
      updateFields += ', jabatan = ?';
      params.push(jabatan.trim());
    }

    if (email !== undefined) {
      updateFields += ', email = ?';
      params.push(email.trim());
    }

    if (no_telp !== undefined) {
      updateFields += ', no_telp = ?';
      params.push(no_telp.trim());
    }

    if (kategori !== undefined) {
      updateFields += ', kategori = ?';
      params.push(kategori.trim());
    }

    if (password && password.trim() !== '') {
      updateFields += ', password = ?';
      params.push(password);
    }

    params.push(user_id);

    await pool.query(
      `UPDATE users SET ${updateFields} WHERE id = ?`,
      params
    );

    // Fetch updated user to return
    const [updatedRows] = await pool.query(
      'SELECT id, username, nama_lengkap, role, is_active, foto_profile, device_id, device_info, tanggal_lahir, gender, alamat, jabatan, email, no_telp, kategori, no_karyawan FROM users WHERE id = ?',
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


// ==========================================
// REMOTE WORKING (WFH) FEATURES
// ==========================================

// 1. Get logged-in user's WFH status for today
app.get('/api/remote/requests/me', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID wajib disertakan' });
    }

    const status = await remoteService.getTodayRemoteStatus(pool, user_id);
    res.json(status);
  } catch (error) {
    console.error('Error fetching WFH status:', error);
    res.status(500).json({ error: 'Gagal mengambil status remote' });
  }
});

// 2. Apply WFH
app.post('/api/remote/requests', async (req, res) => {
  try {
    const { user_id, alasan } = req.body;
    if (!user_id || !alasan) {
      return res.status(400).json({ error: 'User ID dan alasan wajib disertakan' });
    }

    // Check user role & status
    const [userRows] = await pool.query("SELECT nama_lengkap, email, role, is_active FROM users WHERE id = ?", [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    const user = userRows[0];
    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Akun Anda dinonaktifkan atau belum disetujui admin' });
    }

    // Verify WFH creation permission using remoteService
    const wfhStatus = await remoteService.getTodayRemoteStatus(pool, user_id);
    if (!wfhStatus.permissions.remote.allowed) {
      let errorMsg = 'Anda tidak diperbolehkan mengajukan remote working hari ini.';
      if (wfhStatus.permissions.remote.reason === 'WFH_REQUEST_PENDING') {
        errorMsg = 'Anda sudah memiliki permohonan remote pending hari ini.';
      } else if (wfhStatus.permissions.remote.reason === 'WFH_REQUEST_APPROVED') {
        errorMsg = 'Anda sudah memiliki permohonan remote aktif (disetujui) hari ini.';
      } else if (wfhStatus.permissions.remote.reason === 'ALREADY_CLOCKED_IN') {
        errorMsg = 'Tidak dapat mengajukan remote karena Anda sudah melakukan absen masuk hari ini.';
      } else if (wfhStatus.permissions.remote.reason === 'ALREADY_ON_LEAVE') {
        errorMsg = 'Tidak dapat mengajukan remote karena Anda sudah mengajukan izin hari ini.';
      } else if (wfhStatus.permissions.remote.reason === 'ALREADY_ON_SICK_LEAVE') {
        errorMsg = 'Tidak dapat mengajukan remote karena Anda sudah mengajukan sakit hari ini.';
      }
      return res.status(400).json({ error: errorMsg });
    }

    // Generate token
    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const requestId = `rem-${Date.now()}`;
    const todayJakarta = remoteService.getJakartaDate(new Date());
    
    await pool.query(
      "INSERT INTO remote_requests (id, user_id, tanggal, alasan, status, token_hash) VALUES (?, ?, ?, ?, ?, ?)",
      [requestId, user_id, todayJakarta, alasan, REMOTE_STATUS.PENDING, tokenHash]
    );

    // Send email to supervisor
    const formattedDate = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // We send in background, handle potential rejection cleanly
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    sendRemoteApprovalEmail({
      employeeName: user.nama_lengkap,
      rawToken,
      alasan,
      date: formattedDate,
      frontendUrl: origin
    }).catch(emailErr => console.error("Gagal mengirim email permohonan WFH:", emailErr));

    res.json({ success: true, message: 'Permohonan remote berhasil diajukan. Menunggu persetujuan atasan.' });
  } catch (error) {
    console.error('Error creating WFH request:', error);
    res.status(500).json({ error: 'Gagal mengajukan permohonan remote' });
  }
});

// 3. Verify Token Detail (for Approval confirmation page)
app.get('/api/remote/requests/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Token wajib disertakan' });
    }

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await pool.query(
      `SELECT r.id, r.tanggal, r.alasan, r.status, u.nama_lengkap 
       FROM remote_requests r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.token_hash = $1 AND r.status = 'PENDING'`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Token tidak valid, kedaluwarsa, atau sudah diproses.' });
    }

    // Date validation: Check if request date (tanggal) has passed relative to local calendar day in Jakarta
    const reqDateStr = remoteService.getJakartaDate(new Date(rows[0].tanggal));
    const todayStr = remoteService.getJakartaDate(new Date());

    if (reqDateStr < todayStr) {
      return res.status(400).json({ error: 'Pengajuan remote working sudah tidak berlaku karena tanggal pelaksanaan telah terlewati.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching token details:', error);
    res.status(500).json({ error: 'Gagal memverifikasi token' });
  }
});

// 4. Approve WFH Request (RESTful POST with token confirmation)
app.post('/api/remote/requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.body;
    if (!id || !token) {
      return res.status(400).json({ error: 'ID dan token persetujuan wajib disertakan' });
    }

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Calculate expired_at relative to Asia/Jakarta (UTC+7)
    const expiredAt = remoteService.getJakartaExpiredAt(new Date());
    const todayJakarta = remoteService.getJakartaDate(new Date());

    // Atomic update transition with RETURNING * (safety against race conditions and date expiry check)
    const [result] = await pool.query(
      `UPDATE remote_requests 
       SET status = 'APPROVED', 
           action_by = 'Supervisor (Via Email)', 
           action_at = NOW(), 
           expired_at = $1,
           token_hash = NULL -- Void token
       WHERE id = $2 AND status = 'PENDING' AND token_hash = $3 AND tanggal >= $4
       RETURNING *`,
      [expiredAt, id, tokenHash, todayJakarta]
    );

    if (!result || result.length === 0) {
      return res.status(400).json({ 
        error: 'Persetujuan gagal. Pengajuan mungkin sudah diproses, dibatalkan, atau token tidak berlaku.' 
      });
    }

    res.json({ success: true, message: 'Permohonan remote working berhasil disetujui.', request: remoteService.wfhRequestDto(result[0]) });
  } catch (error) {
    console.error('Error approving WFH:', error);
    res.status(500).json({ error: 'Gagal memproses persetujuan remote' });
  }
});

// 5. Reject WFH Request (RESTful POST with token confirmation)
app.post('/api/remote/requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.body;
    if (!id || !token) {
      return res.status(400).json({ error: 'ID dan token penolakan wajib disertakan' });
    }

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const todayJakarta = remoteService.getJakartaDate(new Date());

    // Atomic update transition with RETURNING * (safety against race conditions and date expiry check)
    const [result] = await pool.query(
      `UPDATE remote_requests 
       SET status = 'REJECTED', 
           action_by = 'Supervisor (Via Email)', 
           action_at = NOW(),
           token_hash = NULL -- Void token
       WHERE id = $1 AND status = 'PENDING' AND token_hash = $2 AND tanggal >= $3
       RETURNING *`,
      [id, tokenHash, todayJakarta]
    );

    if (!result || result.length === 0) {
      return res.status(400).json({ 
        error: 'Penolakan gagal. Pengajuan mungkin sudah diproses, dibatalkan, atau token tidak berlaku.' 
      });
    }

    res.json({ success: true, message: 'Permohonan remote working ditolak.', request: remoteService.wfhRequestDto(result[0]) });
  } catch (error) {
    console.error('Error rejecting WFH:', error);
    res.status(500).json({ error: 'Gagal memproses penolakan remote' });
  }
});

// 6. Cancel WFH Request (by User or Admin)
app.post('/api/remote/requests/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.body; // role can be 'admin' or 'user'
    if (!id || !user_id) {
      return res.status(400).json({ error: 'ID dan User ID wajib disertakan' });
    }

    let query = '';
    let params = [];

    // Admin can cancel anything (PENDING or APPROVED)
    if (role === 'admin') {
      query = `
        UPDATE remote_requests 
        SET status = 'CANCELLED', 
            action_by = 'Administrator', 
            action_at = NOW(),
            token_hash = NULL
        WHERE id = $1 AND status IN ('PENDING', 'APPROVED')
        RETURNING *`;
      params = [id];
    } else {
      // User can only cancel PENDING requests
      query = `
        UPDATE remote_requests 
        SET status = 'CANCELLED', 
            action_by = 'Karyawan (User)', 
            action_at = NOW(),
            token_hash = NULL
        WHERE id = $1 AND user_id = $2 AND status = 'PENDING'
        RETURNING *`;
      params = [id, user_id];
    }

    const [result] = await pool.query(query, params);

    if (!result || result.length === 0) {
      return res.status(400).json({ 
        error: 'Pembatalan gagal. Pengajuan tidak ditemukan, sudah kedaluwarsa, atau tidak memiliki otorisasi.' 
      });
    }

    res.json({ success: true, message: 'Permohonan remote working berhasil dibatalkan.', request: remoteService.wfhRequestDto(result[0]) });
  } catch (error) {
    console.error('Error cancelling WFH:', error);
    res.status(500).json({ error: 'Gagal memproses pembatalan remote' });
  }
});

// 7. Submit Daily Report
app.post('/api/remote/requests/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, report_content, attachment_base64 } = req.body;
    if (!id || !user_id || !report_content) {
      return res.status(400).json({ error: 'ID, User ID, dan isi laporan wajib disertakan' });
    }

    // A. Validasi Izin Kirim Laporan via remoteService
    const wfhStatus = await remoteService.getTodayRemoteStatus(pool, user_id);
    if (!wfhStatus.permissions.dailyReport.allowed) {
      let errorMsg = 'Pengiriman Daily Report ditolak.';
      if (wfhStatus.permissions.dailyReport.reason === 'WFH_NOT_APPROVED') {
        errorMsg = 'Anda tidak sedang bekerja remote hari ini (status WFH belum disetujui/aktif).';
      } else if (wfhStatus.permissions.dailyReport.reason === 'NOT_CLOCKED_IN') {
        errorMsg = 'Anda wajib melakukan absensi masuk (clock-in) terlebih dahulu sebelum mengirim Daily Report.';
      } else if (wfhStatus.permissions.dailyReport.reason === 'DAILY_REPORT_ALREADY_SUBMITTED') {
        errorMsg = 'Anda sudah mengirimkan Daily Report untuk hari ini.';
      }
      return res.status(400).json({ error: errorMsg });
    }

    // B. Handle file upload to Supabase Storage if attached
    let attachmentUrl = null;
    if (attachment_base64 && attachment_base64.trim() !== '') {
      try {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB limit
        attachmentUrl = await uploadFileToSupabase(
          attachment_base64, 
          'daily-reports', 
          `report-${user_id}`, 
          allowedMimes, 
          maxSize
        );
      } catch (uploadErr) {
        return res.status(400).json({ error: `Gagal mengunggah lampiran: ${uploadErr.message}` });
      }
    }

    // C. Atomic database-level update to enforce WFH active, not expired, and single-submission constraints
    const [result] = await pool.query(
      `UPDATE remote_requests 
       SET report_content = ?, 
           report_attachment = ?, 
           report_submitted_at = NOW()
       WHERE id = ? 
         AND user_id = ?
         AND status = 'APPROVED' 
         AND expired_at > NOW() 
         AND report_submitted_at IS NULL
       RETURNING *`,
      [report_content, attachmentUrl, id, user_id]
    );

    if (!result || result.length === 0) {
      return res.status(400).json({ 
        error: 'Pengiriman Daily Report gagal. Pastikan status remote Anda aktif, belum kedaluwarsa, dan belum pernah mengirim laporan sebelumnya.' 
      });
    }

    const updatedRequest = result[0];

    // D. Fetch user details to send email notification
    const [userRows] = await pool.query("SELECT nama_lengkap FROM users WHERE id = ?", [user_id]);
    const employeeName = userRows[0]?.nama_lengkap || 'Karyawan';
    const formattedDate = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Send Daily Report email in background and save audit results
    sendDailyReportEmail({
      employeeName,
      reportContent: report_content,
      attachmentUrl: attachmentUrl,
      date: formattedDate
    })
      .then(async () => {
        // Success audit
        await pool.query(
          "UPDATE remote_requests SET report_email_sent_at = NOW(), report_email_failed = NULL WHERE id = ?",
          [id]
        );
      })
      .catch(async (emailErr) => {
        // Fail audit
        console.error("Gagal mengirim email Daily Report:", emailErr);
        await pool.query(
          "UPDATE remote_requests SET report_email_failed = ? WHERE id = ?",
          [emailErr.message || 'Unknown email error', id]
        );
      });

    res.json({ 
      success: true, 
      message: 'Daily Report berhasil dikirim.', 
      request: updatedRequest 
    });
  } catch (error) {
    console.error('Error submitting Daily Report:', error);
    res.status(500).json({ error: 'Gagal mengirim Daily Report harian' });
  }
});

// 8. Get All Requests (Admin list with filters and sorting)
app.get('/api/remote/requests', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;

    let query = `
      SELECT r.*, u.nama_lengkap, u.username, u.jabatan 
      FROM remote_requests r 
      JOIN users u ON r.user_id = u.id
    `;
    let countQuery = `SELECT COUNT(*) as count FROM remote_requests r`;
    let params = [];
    let countParams = [];

    if (status && status !== 'ALL') {
      if (status === 'EXPIRED') {
        // Logical check for expired approved requests
        query += ` WHERE r.status = 'APPROVED' AND r.expired_at <= NOW()`;
        countQuery += ` WHERE r.status = 'APPROVED' AND r.expired_at <= NOW()`;
      } else if (status === 'APPROVED_ACTIVE') {
        // Logical check for active approved requests
        query += ` WHERE r.status = 'APPROVED' AND r.expired_at > NOW()`;
        countQuery += ` WHERE r.status = 'APPROVED' AND r.expired_at > NOW()`;
      } else {
        query += ` WHERE r.status = ?`;
        countQuery += ` WHERE r.status = ?`;
        params.push(status);
        countParams.push(status);
      }
    }

    query += ` ORDER BY r.created_at DESC`;

    if (limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
    }
    if (offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(offset));
    }

    const [rows] = await pool.query(query, params);
    const [countRows] = await pool.query(countQuery, countParams);
    const totalCount = countRows[0]?.count || 0;

    // Map logical expired status for readability in admin UI
    const mapped = rows.map(r => {
      const isExpired = r.status === REMOTE_STATUS.APPROVED && new Date() >= new Date(r.expired_at);
      return {
        ...r,
        logical_status: isExpired ? 'EXPIRED' : r.status
      };
    });

    res.json({ requests: mapped, total: totalCount });
  } catch (error) {
    console.error('Error fetching admin WFH logs:', error);
    res.status(500).json({ error: 'Gagal mengambil data riwayat remote' });
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
