const express = require('express');
const mysql = require('pg');
mysql.types.setTypeParser(1082, (val) => val); // Prevent pg from shifting DATE values by returning them as raw strings
mysql.types.setTypeParser(1114, (val) => new Date(val.replace(' ', 'T') + 'Z')); // Prevent pg from parsing TIMESTAMP using Node process local time offset
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
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
const cryptoService = require('./services/cryptoService');
const stationService = require('./services/stationService');

const UPLOAD_CONFIG = {
  BUCKET_NAME: 'daily-reports',
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
};

function parseReportAttachments(attachmentValue) {
  if (!attachmentValue) return [];
  const trimmed = attachmentValue.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [trimmed];
    } catch (e) {
      return [trimmed];
    }
  }
  return [trimmed];
}

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

async function deleteFileFromSupabaseUrl(url, bucketName) {
  if (!supabase || !url) return;
  try {
    const prefix = `${supabaseUrl}/storage/v1/object/public/${bucketName}/`;
    if (url.startsWith(prefix)) {
      const fileName = url.replace(prefix, '');
      if (fileName) {
        await supabase.storage.from(bucketName).remove([fileName]);
      }
    }
  } catch (err) {
    console.error(`Gagal menghapus berkas dari bucket ${bucketName}:`, err);
  }
}

// Helper to generate employee number (yyyymmdd02nourutbergabung)
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
  const suffix = String(count + 1).padStart(2, '0');
  
  return `${prefix}${suffix}`;
}

const app = express();
app.set('trust proxy', true);
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
  
  const attachments = [];
  let inlineImageHtml = '';

  if (fileBuffer) {
    attachments.push({
      filename: fileName || 'lampiran.jpg',
      content: fileBuffer,
      cid: 'attachment_preview'
    });
    inlineImageHtml = `
      <div style="margin-top: 20px; border-top: 1px dashed #eee; padding-top: 15px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666; font-weight: 600;">Pratinjau Dokumen Lampiran:</p>
        <img src="cid:attachment_preview" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.02);" />
      </div>
    `;
  } else if (filePath && fs.existsSync(filePath)) {
    attachments.push({
      filename: fileName || 'lampiran.jpg',
      path: filePath,
      cid: 'attachment_preview'
    });
    inlineImageHtml = `
      <div style="margin-top: 20px; border-top: 1px dashed #eee; padding-top: 15px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666; font-weight: 600;">Pratinjau Dokumen Lampiran:</p>
        <img src="cid:attachment_preview" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.02);" />
      </div>
    `;
  }

  const html = `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 30px 15px; color: #374151; line-height: 1.6;">
      <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); border-top: 6px solid #2AB0B2;">
        
        <!-- Header Banner -->
        <div style="background-color: #2AB0B2; padding: 25px 20px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">Permohonan Izin / Sakit</h2>
          <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px;">Sistem Absensi Online</p>
        </div>
        
        <!-- Content Body -->
        <div style="padding: 30px 25px;">
          <p style="margin-top: 0; font-size: 15px; color: #4b5563;">Yth. HRD / Administrator,</p>
          <p style="font-size: 15px; color: #4b5563;">Melalui email ini, saya mengajukan permohonan izin ketidakhadiran kerja dengan rincian berikut:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 14px; background-color: #fafafa; border-radius: 8px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600; width: 130px;">Nama Karyawan</td>
              <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: 500;">${senderName}</td>
            </tr>
            <tr>
              <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600;">Status Kehadiran</td>
              <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6;">
                <span style="display: inline-block; padding: 4px 12px; background-color: ${status === 'Sakit' ? '#fef3c7' : '#e0f2fe'}; color: ${status === 'Sakit' ? '#d97706' : '#0369a1'}; border-radius: 9999px; font-weight: 600; font-size: 12px;">
                  ${status}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600;">Hari / Tanggal</td>
              <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #111827;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 12px 15px; color: #6b7280; font-weight: 600; vertical-align: top;">Keterangan / Alasan</td>
              <td style="padding: 12px 15px; color: #111827; white-space: pre-wrap;">${status === 'Sakit' ? 'Sakit (Foto bukti surat keterangan dokter terlampir)' : reason}</td>
            </tr>
          </table>

          ${inlineImageHtml}

          <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Hormat saya,</p>
            <p style="margin: 5px 0 0 0; font-weight: 600; color: #1f2937; font-size: 15px;">${senderName}</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
          Email ini dikirim secara otomatis oleh Sistem Absensi SampulKreativ.<br/>
          &copy; ${new Date().getFullYear()} <a href="https://sampulkreativ.id" style="color: #2AB0B2; text-decoration: none; font-weight: 500;">sampulkreativ.id</a>. All rights reserved.
        </div>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"${senderName}" <${finalSender}>`,
    to,
    subject,
    html,
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
    from: `"${employeeName}" <${finalSender}>`,
    to,
    subject: `[Pengajuan WFH] ${employeeName} - ${date}`,
    html: `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 30px 15px; color: #374151; line-height: 1.6;">
        <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); border-top: 6px solid #2AB0B2;">
          
          <!-- Header Banner -->
          <div style="background-color: #2AB0B2; padding: 25px 20px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">Pengajuan Kerja Jarak Jauh (WFH)</h2>
            <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px;">Sistem Absensi Online</p>
          </div>
          
          <!-- Content Body -->
          <div style="padding: 30px 25px;">
            <p style="margin-top: 0; font-size: 15px; color: #4b5563;">Halo Administrator / Atasan,</p>
            <p style="font-size: 15px; color: #4b5563;">Karyawan berikut mengajukan permohonan Remote Working (WFH):</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 14px; background-color: #fafafa; border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600; width: 130px;">Nama Karyawan</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: 500;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600;">Tanggal Kerja</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #111827;">${date}</td>
              </tr>
              <tr>
                <td style="padding: 12px 15px; color: #6b7280; font-weight: 600; vertical-align: top;">Alasan Pengajuan</td>
                <td style="padding: 12px 15px; color: #111827; white-space: pre-wrap;">${alasan}</td>
              </tr>
            </table>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${approvalLink}" style="display: inline-block; padding: 12px 28px; background-color: #2AB0B2; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(42, 176, 178, 0.15); transition: background-color 0.2s;">
                Tinjau Pengajuan
              </a>
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">Jika tombol di atas tidak dapat diklik, salin dan buka tautan berikut di browser Anda:</p>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #2AB0B2; word-break: break-all;">${approvalLink}</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
            Email ini dikirim secara otomatis oleh Sistem Absensi SampulKreativ.<br/>
            &copy; ${new Date().getFullYear()} <a href="https://sampulkreativ.id" style="color: #2AB0B2; text-decoration: none; font-weight: 500;">sampulkreativ.id</a>. All rights reserved.
          </div>
        </div>
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

  const urls = parseReportAttachments(attachmentUrl);

  let attachmentDisplayHtml = '';
  if (urls.length > 0) {
    let listHtml = '';
    let previewImagesHtml = '';
    
    urls.forEach((url, index) => {
      const fileName = url.split('/').pop() || `Lampiran ${index + 1}`;
      listHtml += `
        <div style="margin-bottom: 8px;">
          <a href="${url}" target="_blank" style="color: #2AB0B2; text-decoration: none; font-weight: 600;">
            📎 ${fileName} &rarr;
          </a>
        </div>
      `;
      
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url) || url.includes('foto_profile') || url.includes('attachments');
      if (isImage) {
        previewImagesHtml += `
          <div style="margin-top: 10px; text-align: center;">
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280; text-align: left;">Pratinjau: ${fileName}</p>
            <img src="${url}" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.02);" />
          </div>
        `;
      }
    });

    attachmentDisplayHtml = `
      <div style="margin-top: 20px; font-size: 14px;">
        <span style="color: #6b7280; font-weight: 600; display: block; margin-bottom: 8px;">Dokumen Lampiran (${urls.length}):</span>
        ${listHtml}
        ${previewImagesHtml ? `
          <div style="margin-top: 15px; border-top: 1px dashed #e5e7eb; padding-top: 15px;">
            ${previewImagesHtml}
          </div>
        ` : ''}
      </div>
    `;
  } else {
    attachmentDisplayHtml = '<p style="font-size: 14px; color: #9ca3af; font-style: italic; margin-top: 20px;">Tidak ada lampiran berkas.</p>';
  }

  const mailOptions = {
    from: `"${employeeName}" <${finalSender}>`,
    to,
    subject: `[Daily Report WFH] ${employeeName} - ${date}`,
    html: `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 30px 15px; color: #374151; line-height: 1.6;">
        <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); border-top: 6px solid #2AB0B2;">
          
          <!-- Header Banner -->
          <div style="background-color: #2AB0B2; padding: 25px 20px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">Laporan Kerja Harian (Daily Report)</h2>
            <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px;">Sistem Absensi Online</p>
          </div>
          
          <!-- Content Body -->
          <div style="padding: 30px 25px;">
            <p style="margin-top: 0; font-size: 15px; color: #4b5563;">Halo Administrator / Atasan,</p>
            <p style="font-size: 15px; color: #4b5563;">Berikut adalah laporan kerja harian (WFH) yang diserahkan oleh:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 14px; background-color: #fafafa; border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600; width: 130px;">Nama Karyawan</td>
                <td style="padding: 12px 15px; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: 500;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 15px; color: #6b7280; font-weight: 600;">Tanggal Laporan</td>
                <td style="padding: 12px 15px; color: #111827;">${date}</td>
              </tr>
            </table>

            <div style="margin-top: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; font-weight: 600;">Rincian Laporan Kerja:</p>
              <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; padding: 20px; border-radius: 8px; font-size: 14px; color: #1f2937; white-space: pre-wrap; line-height: 1.6;">${reportContent}</div>
            </div>

            ${attachmentDisplayHtml}

            <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Hormat saya,</p>
              <p style="margin: 5px 0 0 0; font-weight: 600; color: #1f2937; font-size: 15px;">${employeeName}</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
            Email ini dikirim secara otomatis oleh Sistem Absensi SampulKreativ.<br/>
            &copy; ${new Date().getFullYear()} <a href="https://sampulkreativ.id" style="color: #2AB0B2; text-decoration: none; font-weight: 500;">sampulkreativ.id</a>. All rights reserved.
          </div>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

let connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/absensi_db';
if (connectionString.includes('?')) {
  connectionString += '&options=-c%20timezone=Asia/Jakarta';
} else {
  connectionString += '?options=-c%20timezone=Asia/Jakarta';
}

const pgPool = new mysql.Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const pool = {
  pgPool: pgPool,
  connect: () => pgPool.connect(),
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

    const hasPgPlaceholders = text.includes('$');
    let pgParams = [];
    if (params && !hasPgPlaceholders) {
      let paramIndex = 1;
      let queryParts = pgText.split('?');
      let newPgText = '';
      for (let i = 0; i < queryParts.length - 1; i++) {
        newPgText += queryParts[i];
        const paramVal = params[i];
        if (Array.isArray(paramVal)) {
          if (paramVal.length === 0) {
            newPgText += 'NULL';
          } else {
            const expanded = paramVal.map(() => `$${paramIndex++}`).join(', ');
            newPgText += expanded;
            pgParams.push(...paramVal);
          }
        } else {
          newPgText += `$${paramIndex++}`;
          pgParams.push(paramVal);
        }
      }
      newPgText += queryParts[queryParts.length - 1];
      pgText = newPgText;
    } else {
      pgParams = params || [];
    }

    const res = await pgPool.query(pgText, pgParams);
    
    const rows = res.rows.map(row => {
      const mappedRow = { ...row };
      for (const key in mappedRow) {
        if (key === 'cnt' || key === 'count') {
          mappedRow[key] = Number(mappedRow[key]);
        }
      }
      return mappedRow;
    });

    rows.affectedRows = res.rowCount;
    return [rows];
  },
  queryWithClient: async (client, text, params) => {
    let pgText = text;
    pgText = pgText.replace(/TINYINT\(1\)/gi, 'SMALLINT');
    pgText = pgText.replace(/DATETIME/gi, 'TIMESTAMP');
    pgText = pgText.replace(/ON DUPLICATE KEY UPDATE token = \?, created_at = \?, is_active = \?/gi, 
      'ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token, created_at = EXCLUDED.created_at, is_active = EXCLUDED.is_active');
    pgText = pgText.replace(/ON DUPLICATE KEY UPDATE key_value = \?/gi, 
      'ON CONFLICT (key_name) DO UPDATE SET key_value = EXCLUDED.key_value');
    pgText = pgText.replace(/ON DUPLICATE KEY UPDATE key_value = key_value/gi, 
      'ON CONFLICT (key_name) DO NOTHING');

    const hasPgPlaceholders = text.includes('$');
    let pgParams = [];
    if (params && !hasPgPlaceholders) {
      let paramIndex = 1;
      let queryParts = pgText.split('?');
      let newPgText = '';
      for (let i = 0; i < queryParts.length - 1; i++) {
        newPgText += queryParts[i];
        const paramVal = params[i];
        if (Array.isArray(paramVal)) {
          if (paramVal.length === 0) {
            newPgText += 'NULL';
          } else {
            const expanded = paramVal.map(() => `$${paramIndex++}`).join(', ');
            newPgText += expanded;
            pgParams.push(...paramVal);
          }
        } else {
          newPgText += `$${paramIndex++}`;
          pgParams.push(paramVal);
        }
      }
      newPgText += queryParts[queryParts.length - 1];
      pgText = newPgText;
    } else {
      pgParams = params || [];
    }

    const res = await client.query(pgText, pgParams);
    
    const rows = res.rows.map(row => {
      const mappedRow = { ...row };
      for (const key in mappedRow) {
        if (key === 'cnt' || key === 'count') {
          mappedRow[key] = Number(mappedRow[key]);
        }
      }
      return mappedRow;
    });

    rows.affectedRows = res.rowCount;
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
      await pool.query("ALTER TABLE users ADD COLUMN kie_debt INT DEFAULT 0");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN last_kie_debt_date DATE DEFAULT CURRENT_DATE");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(100) NULL");
    } catch (err) {
      // Column already exists, safe to ignore
    }

    try {
      await pool.query("ALTER TABLE users ADD COLUMN telegram_chat_name VARCHAR(255) NULL");
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
        "SELECT id, created_at FROM users WHERE role = 'employee' AND (no_karyawan IS NULL OR no_karyawan = '') ORDER BY created_at ASC, id ASC"
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

    try {
      await pool.query("ALTER TABLE payroll_slips ADD COLUMN transfer_proof VARCHAR(255) DEFAULT NULL");
    } catch (err) {}

    // Migrate any existing 'pkl' roles to 'student'
    try {
      await pool.query("UPDATE users SET role = 'student' WHERE role = 'pkl'");
      await pool.query("UPDATE users SET kategori = 'PKL' WHERE role = 'student'");
      await pool.query("UPDATE users SET kategori = 'Karyawan' WHERE role = 'employee'");
    } catch (err) {
      console.error("Gagal melakukan migrasi role pkl ke student/kategori:", err);
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
    await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('show_pkl_scoreboard', '1') ON DUPLICATE KEY UPDATE key_value = key_value");

    // Migration: Reset student KIE debt to recalculate excluding weekends
    const [migratedRows] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'kie_weekend_migrated'");
    if (migratedRows.length === 0 || migratedRows[0].key_value !== '1') {
      console.log("Migrasi KIE: Mereset hutang KIE siswa untuk menghitung ulang tanpa hari Sabtu dan Minggu...");
      await pool.query("UPDATE users SET last_kie_debt_date = NULL, kie_debt = 0 WHERE role = 'student'");
      await pool.query("INSERT INTO settings (key_name, key_value) VALUES ('kie_weekend_migrated', '1') ON CONFLICT (key_name) DO UPDATE SET key_value = '1'");
      console.log("Migrasi KIE: Selesai.");
    }

    // Migration: Update program weeks unique constraint
    try {
      await pool.query("ALTER TABLE pkl_program_weeks DROP CONSTRAINT IF EXISTS uq_template_week");
      await pool.query("ALTER TABLE pkl_program_weeks ADD CONSTRAINT uq_template_month_week UNIQUE (template_id, month_number, week_number)");
    } catch (err) {
      console.error("Gagal memperbarui unique constraint pkl_program_weeks:", err);
    }

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

    // Create indexes for users and absensi tables to optimize matching device & loading attendance logs
    try {
      await pool.query("CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username))");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_absensi_user_id ON absensi(user_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_absensi_waktu_absen ON absensi(waktu_absen DESC)");
    } catch (indexErr) {
      console.warn("Gagal membuat index users/absensi:", indexErr);
    }

    // 6. Run database migrations dynamically
    try {
      const { runMigrations } = require('./services/migration-runner');
      await runMigrations(pool);
    } catch (migError) {
      console.error("Gagal menjalankan migrasi basis data terprogram:", migError);
      throw migError; // Mencegah server startup jika migrasi gagal
    }

    // 7. Run database seeders dynamically in development
    try {
      const { runSeeders } = require('./seeders/index');
      await runSeeders(pool);
    } catch (seedError) {
      console.error("Gagal menjalankan database seeder terprogram:", seedError);
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

// Middleware to validate device session for employee role
const validateDeviceSession = async (req, res, next) => {
  try {
    const user_id = req.body.user_id || req.query.user_id || req.headers['x-user-id'];
    const device_id = req.body.device_id || req.query.device_id || req.headers['x-device-id'];

    if (!user_id) {
      return res.status(400).json({ error: 'User ID wajib disertakan' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    const user = rows[0];

    // Only validate device session for employee, student, or mentor roles
    if (['employee', 'student', 'mentor'].includes(user.role)) {
      if (user.is_active !== 1) {
        return res.status(403).json({ error: 'Akun Anda dinonaktifkan atau belum disetujui admin' });
      }

      if (!user.device_id || user.device_id.trim() === '') {
        // Exclude logout path so frontend can clear local storage
        if (req.path === '/api/auth/logout') {
          req.user = user;
          return next();
        }
        return res.status(401).json({ error: 'Perangkat Anda belum terdaftar atau telah di-reset. Silakan login kembali.' });
      }

      if (!device_id || device_id !== user.device_id) {
        return res.status(401).json({ error: 'Sesi perangkat Anda tidak valid. Silakan login kembali.' });
      }
    }

    // Attach user context to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in validateDeviceSession middleware:', error);
    res.status(500).json({ error: 'Terjadi kesalahan verifikasi sesi perangkat' });
  }
};

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
      no_telp: user.no_telp || '',
      card_token: cryptoService.encrypt(user.username)
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
      "SELECT * FROM users WHERE LOWER(username) = ? AND role IN ('employee', 'student', 'mentor')",
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
          error: 'Akun ini sudah terdaftar pada perangkat lain. Silakan lakukan Logout dari perangkat tersebut terlebih dahulu. Apabila perangkat sudah tidak dapat digunakan, silakan hubungi Administrator untuk melakukan Reset Device.'
        });
      }
    } else {
      // If not bound yet, bind it now with race condition check (atomic update)
      const [updateResult] = await pool.query(
        "UPDATE users SET device_id = ?, device_info = ? WHERE id = ? AND (device_id IS NULL OR device_id = '' OR device_id = ?)",
        [device_id, device_info, user.id, device_id]
      );
      if (updateResult.affectedRows === 0) {
        return res.status(403).json({
          error: 'Akun ini sudah terdaftar pada perangkat lain. Silakan lakukan Logout dari perangkat tersebut terlebih dahulu. Apabila perangkat sudah tidak dapat digunakan, silakan hubungi Administrator untuk melakukan Reset Device.'
        });
      }
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
      no_karyawan: user.no_karyawan || '',
      card_token: cryptoService.encrypt(user.username)
    });
  } catch (error) {
    console.error('Gagal melakukan login karyawan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan internal server' });
  }
});

// 2b. Auth QR Login — karyawan/student scan QR kartu untuk login (QR sama dengan QR absensi)
app.post('/api/auth/qr-login', async (req, res) => {
  try {
    const { token, device_id, device_info } = req.body;
    if (!token || !device_id) {
      return res.status(400).json({ error: 'Token QR dan perangkat wajib disertakan' });
    }

    // Decrypt card_token to get username
    let username;
    try {
      username = cryptoService.decrypt(token);
    } catch (e) {
      return res.status(401).json({ error: 'QR Code tidak valid atau tidak dikenali' });
    }

    if (!username) {
      return res.status(401).json({ error: 'QR Code tidak valid' });
    }

    // Find the user (must be employee/student/mentor, not admin)
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE LOWER(username) = ? AND role IN ('employee', 'student', 'mentor')",
      [username.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'QR Code tidak ditemukan atau bukan akun karyawan' });
    }

    const user = rows[0];

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Akun Anda belum diaktifkan oleh Administrator' });
    }

    // Device binding — same atomic logic as login-employee
    if (user.device_id && user.device_id.trim() !== '') {
      if (user.device_id !== device_id) {
        return res.status(403).json({
          error: 'QR Code ini sudah terdaftar pada perangkat lain. Hubungi Administrator untuk melakukan Reset Perangkat.'
        });
      }
    } else {
      const [updateResult] = await pool.query(
        "UPDATE users SET device_id = ?, device_info = ? WHERE id = ? AND (device_id IS NULL OR device_id = '' OR device_id = ?)",
        [device_id, device_info, user.id, device_id]
      );
      if (updateResult.affectedRows === 0) {
        return res.status(403).json({
          error: 'QR Code ini sudah terdaftar pada perangkat lain. Hubungi Administrator untuk melakukan Reset Perangkat.'
        });
      }
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
      no_karyawan: user.no_karyawan || '',
      card_token: cryptoService.encrypt(user.username)
    });
  } catch (error) {
    console.error('Gagal melakukan QR login:', error);
    res.status(500).json({ error: 'Terjadi kesalahan internal server' });
  }
});

app.post('/api/auth/logout', validateDeviceSession, async (req, res) => {
  try {
    const user = req.user;

    if (!user.device_id) {
      return res.json({ success: true, message: 'Logout berhasil' });
    }

    const [result] = await pool.query(
      'UPDATE users SET device_id = NULL, device_info = NULL WHERE id = ? AND device_id = ?',
      [user.id, user.device_id]
    );

    if (result.affectedRows === 0) {
      return res.status(401).json({ error: 'Sesi perangkat tidak valid atau sudah dibersihkan' });
    }

    res.json({ success: true, message: 'Logout berhasil' });
  } catch (error) {
    console.error('Gagal melakukan logout:', error);
    res.status(500).json({ error: 'Terjadi kesalahan internal server saat logout' });
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
        [userId, trimmedUsername, 'no_password', trimmedNama, 'employee', 0, '/uploads/placeholder.jpg', device_id, device_info, noKaryawan]
      );
      user = {
        id: userId,
        username: trimmedUsername,
        nama_lengkap: trimmedNama,
        role: 'employee',
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
        no_karyawan: user.no_karyawan || '',
        card_token: cryptoService.encrypt(user.username)
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

    const missingRecords = [];
    let current = new Date(signupDate);
    while (current.getTime() <= yesterday.getTime()) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      const dayOfWeek = current.getDay();
      
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !existingDates.has(dateStr)) {
        const recordId = `alpa-${userId}-${dateStr}`;
        const waktuAbsen = new Date(current);
        waktuAbsen.setHours(9, 0, 0, 0);

        missingRecords.push({
          id: recordId,
          user_id: userId,
          username: user.username,
          nama_lengkap: user.nama_lengkap,
          waktu_absen: waktuAbsen,
          foto_url: 'placeholder',
          latitude: null,
          longitude: null,
          status: 'Alpa',
          diubah_oleh_admin: 0
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (missingRecords.length > 0) {
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      for (const rec of missingRecords) {
        placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9})`);
        values.push(rec.id, rec.user_id, rec.username, rec.nama_lengkap, rec.waktu_absen, rec.foto_url, rec.latitude, rec.longitude, rec.status, rec.diubah_oleh_admin);
        paramIndex += 10;
      }

      await pool.query(
        `INSERT INTO absensi (id, user_id, username, nama_lengkap, waktu_absen, foto_url, latitude, longitude, status, diubah_oleh_admin) 
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (id) DO NOTHING`,
        values
      );
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
      // Jalankan fillAlpaForUser di background agar tidak memblokir respon HTTP
      fillAlpaForUser(user_id).catch(err => console.error("Error fillAlpaForUser background:", err));
    } else {
      // Jalankan fillAlpa untuk seluruh user di background agar admin list loading cepat
      (async () => {
        const [users] = await pool.query("SELECT id FROM users WHERE role IN ('employee', 'student', 'mentor') AND is_active = 1");
        for (const u of users) {
          await fillAlpaForUser(u.id);
        }
      })().catch(err => console.error("Error fillAlpaForUsers list background:", err));
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

function registerTelegramWebhook(botToken, host) {
  return new Promise((resolve, reject) => {
    if (!botToken || botToken.trim() === '') {
      return resolve({ success: false, message: 'Bot token kosong' });
    }

    const webhookUrl = `https://${host}/api/telegram/webhook`;
    const data = JSON.stringify({
      url: webhookUrl
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/setWebhook`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (parsed.ok) {
            console.log(`Telegram Webhook berhasil diset ke ${webhookUrl}`);
            resolve({ success: true, message: parsed.description });
          } else {
            console.error('Gagal menyetel Telegram Webhook:', parsed);
            resolve({ success: false, message: parsed.description });
          }
        } catch (err) {
          console.error('Gagal mengurai respon setWebhook Telegram:', err);
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      console.error('Kesalahan jaringan saat mendaftarkan Telegram Webhook:', err);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

function sendTelegramReply(botToken, chatId, text, replyToMessageId) {
  return new Promise((resolve, reject) => {
    const bodyObj = {
      chat_id: chatId,
      text: text
    };
    if (replyToMessageId) {
      bodyObj.reply_to_message_id = replyToMessageId;
    }
    const data = JSON.stringify(bodyObj);

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
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
    
    const [userRows] = await pool.query("SELECT role FROM users WHERE id = ?", [newRecord.user_id]);
    const userRole = userRows[0]?.role || 'employee';
    
    const botToken = botTokenSetting[0]?.key_value;
    let chatId = '';
    if (userRole === 'student') {
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
    if (['employee', 'student', 'mentor'].includes(user.role) && user.device_id && user.device_id.trim() !== '') {
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
      const officeLat = officeLatStr ? parseFloat(officeLatStr.replace(',', '.')) : NaN;
      const officeLng = officeLngStr ? parseFloat(officeLngStr.replace(',', '.')) : NaN;
      console.log(`[GPS_OFFICE_SETTINGS]\nofficeLatRaw: ${officeLatStr}\nofficeLngRaw: ${officeLngStr}\nofficeLat: ${officeLat}\nofficeLng: ${officeLng}`);
      
      if (officeLatStr && officeLngStr && officeLatStr.trim() !== '' && officeLngStr.trim() !== '') {
        if (!latitude || !longitude) {
          return res.status(400).json({ error: 'GPS perangkat wajib diaktifkan untuk melakukan absensi' });
        }

        const isWFHActive = remoteStatus === REMOTE_STATUS.APPROVED;

        if (!isWFHActive) {
          const distance = getDistanceInMeters(parseFloat(latitude), parseFloat(longitude), officeLat, officeLng);
          console.log("[GPS_ATTENDANCE_VERIFICATION]", {
            officeLatRaw: officeLatStr,
            officeLngRaw: officeLngStr,
            officeLat,
            officeLng,
            userLat: parseFloat(latitude),
            userLng: parseFloat(longitude),
            distance
          });
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
            await fs.promises.writeFile(filepath, fileBuffer);
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

app.get('/api/attendance/station/verify', async (req, res) => {
  try {
    const { token } = req.query;
    const result = await stationService.verifyStationToken(pool, token);
    if (!result.success) {
      return res.status(400).json({ error: result.error, user: result.user });
    }
    res.json(result);
  } catch (error) {
    console.error('Gagal memverifikasi token stasiun:', error);
    res.status(500).json({ error: 'Terjadi kesalahan sistem saat memverifikasi token.' });
  }
});

app.post('/api/attendance/station/checkin', async (req, res) => {
  try {
    const { token, foto_base64, status } = req.body;
    if (!token || !foto_base64 || !status) {
      return res.status(400).json({ error: 'Data absensi stasiun tidak lengkap.' });
    }

    const verifyResult = await stationService.verifyStationToken(pool, token);
    if (!verifyResult.success) {
      return res.status(400).json({ error: verifyResult.error });
    }

    const { user, next_status } = verifyResult;
    if (next_status !== status) {
      return res.status(400).json({ error: `Status absensi tidak cocok. Seharusnya ${next_status}, tetapi menerima ${status}.` });
    }

    const [botTokenSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_bot_token'");
    const [chatIdSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_chat_id'");
    
    const botToken = botTokenSetting[0]?.key_value;
    const chatId = chatIdSetting[0]?.key_value;
    const hasTelegram = botToken && chatId && botToken.trim() !== '' && chatId.trim() !== '';

    const { newRecord, fileBuffer, filename } = await stationService.checkinStation(pool, user, status, foto_base64, hasTelegram);

    triggerTelegramNotification(newRecord, fileBuffer, filename).catch(err => {
      console.error("Gagal mengirim notifikasi Telegram dari stasiun:", err);
    });

    res.json({ success: true, record: newRecord });
  } catch (error) {
    console.error('Gagal memproses checkin stasiun:', error);
    res.status(500).json({ error: 'Terjadi kesalahan internal server saat memproses absensi.' });
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

app.get('/api/pkl-templates', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.id, 
        t.title, 
        t.duration_months,
        CAST(COUNT(s.id) AS INTEGER) as student_count
      FROM pkl_program_templates t
      LEFT JOIN pkl_students s ON t.id = s.program_template_id AND s.status = 'ACTIVE'
      GROUP BY t.id, t.title, t.duration_months
      ORDER BY t.title ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Gagal memuat program template:", error);
    res.status(500).json({ error: 'Gagal memuat program template' });
  }
});

app.get('/api/pkl-templates/:templateId/students', async (req, res) => {
  try {
    const { templateId } = req.params;
    const [rows] = await pool.query(`
      SELECT u.id, s.id AS student_id, u.nama_lengkap, s.school_name, s.start_date, s.end_date
      FROM pkl_students s
      JOIN users u ON s.user_id = u.id
      WHERE s.program_template_id = ? AND s.status = 'ACTIVE'
      ORDER BY u.nama_lengkap ASC
    `, [templateId]);
    res.json(rows);
  } catch (error) {
    console.error("Gagal memuat siswa template:", error);
    res.status(500).json({ error: 'Gagal memuat siswa template' });
  }
});

// 4. Users CRUD API
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.id, u.username, u.nama_lengkap, u.role, u.is_active, u.foto_profile, u.device_id, u.device_info, 
        u.tanggal_lahir, u.gender, u.alamat, u.jabatan, u.email, u.no_telp, u.kategori, u.no_karyawan, u.telegram_chat_id, u.telegram_chat_name,
        s.school_name, s.mentor_id, m.nama_lengkap AS mentor_name, 
        s.program_template_id, t.title AS program_template_name, 
        s.start_date, s.end_date, s.status AS pkl_status,
        (SELECT COUNT(*) FROM kie_submissions k WHERE k.user_id = u.id) AS kie_submissions_count
      FROM users u
      LEFT JOIN pkl_students s ON u.id = s.user_id
      LEFT JOIN users m ON s.mentor_id = m.id
      LEFT JOIN pkl_program_templates t ON s.program_template_id = t.id
      ORDER BY u.nama_lengkap ASC
    `);
    const mapped = rows.map(u => {
      let start_date = null;
      if (u.start_date) {
        start_date = new Date(u.start_date).toISOString().split('T')[0];
      }
      let end_date = null;
      if (u.end_date) {
        end_date = new Date(u.end_date).toISOString().split('T')[0];
      }
      return {
        ...u,
        is_active: u.is_active === 1,
        start_date,
        end_date,
        card_token: cryptoService.encrypt(u.username)
      };
    });
    res.json(mapped);
  } catch (error) {
    console.error("Gagal memuat daftar pengguna:", error);
    res.status(500).json({ error: 'Gagal memuat daftar pengguna' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { nama_lengkap, username, password, role, jabatan, email, no_telp, school_name, mentor_id, program_template_id, start_date, end_date, telegram_chat_id } = req.body;
    if (!nama_lengkap || !username || !password || !role) {
      return res.status(400).json({ error: 'Data pengguna tidak lengkap' });
    }

    const [existRows] = await pool.query('SELECT * FROM users WHERE LOWER(username) = ?', [username.trim().toLowerCase()]);
    if (existRows.length > 0) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    const allowedRoles = ['employee', 'student', 'mentor', 'admin'];
    const lowRole = role.toLowerCase();
    if (!allowedRoles.includes(lowRole)) {
      return res.status(400).json({ error: 'Role tidak valid' });
    }
    const dbRole = lowRole;

    if (dbRole === 'student') {
      if (!school_name || !mentor_id || !program_template_id || !start_date || !end_date) {
        return res.status(400).json({ error: 'Data profil PKL tidak lengkap' });
      }
      const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (start_date > todayStr) {
        return res.status(400).json({ error: 'Tanggal mulai magang tidak boleh di masa depan' });
      }
    }

    let noKaryawan = null;
    if (dbRole === 'employee') {
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
      no_karyawan: noKaryawan,
      kategori: dbRole === 'student' ? 'PKL' : 'Karyawan',
      telegram_chat_id: telegram_chat_id ? telegram_chat_id.trim() : null
    };

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await pool.queryWithClient(client,
        `INSERT INTO users (id, username, password, nama_lengkap, role, is_active, foto_profile, jabatan, email, no_telp, no_karyawan, kategori, telegram_chat_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newUser.id, newUser.username, newUser.password, newUser.nama_lengkap, newUser.role, newUser.is_active, newUser.foto_profile, newUser.jabatan, newUser.email, newUser.no_telp, noKaryawan, newUser.kategori, newUser.telegram_chat_id]
      );

      if (dbRole === 'student') {
        const studentProfileId = `std-${Date.now()}`;
        await pool.queryWithClient(client,
          `INSERT INTO pkl_students (id, user_id, mentor_id, program_template_id, school_name, start_date, end_date, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          [studentProfileId, newUser.id, mentor_id, program_template_id, school_name.trim(), start_date, end_date]
        );
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error("Gagal melakukan transaksi insert user & siswa:", dbErr);
      return res.status(500).json({ error: 'Gagal membuat pengguna baru' });
    } finally {
      client.release();
    }

    const { password: _, ...safeUser } = newUser;
    res.json({ success: true, user: { ...safeUser, is_active: true } });
  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat pengguna baru' });
  }
});

app.put('/api/users', async (req, res) => {
  try {
    const { id, nama_lengkap, username, password, is_active, role, jabatan, email, no_telp, school_name, mentor_id, program_template_id, start_date, end_date, telegram_chat_id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID Pengguna wajib disertakan' });
    }

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const user = userRows[0];

    const nama_lengkap_val = nama_lengkap !== undefined ? nama_lengkap : user.nama_lengkap;
    const username_val = username !== undefined ? username : user.username;

    if (!nama_lengkap_val || !username_val) {
      return res.status(400).json({ error: 'Nama lengkap dan username tidak boleh kosong' });
    }

    const [dupRows] = await pool.query('SELECT * FROM users WHERE id != ? AND LOWER(username) = ?', [id, username_val.trim().toLowerCase()]);
    if (dupRows.length > 0) {
      return res.status(400).json({ error: 'Username/nomor HP sudah digunakan oleh akun lain' });
    }

    const currentRole = user.role;
    const targetRole = role ? role.toLowerCase() : currentRole;

    let school_name_val = school_name;
    let mentor_id_val = mentor_id;
    let program_template_id_val = program_template_id;
    let start_date_val = start_date;
    let end_date_val = end_date;

    if (targetRole === 'student') {
      const [studentRows] = await pool.query('SELECT mentor_id, program_template_id, school_name, start_date, end_date FROM pkl_students WHERE user_id = ?', [id]);
      const studentProfile = studentRows.length > 0 ? studentRows[0] : null;

      const existingSchoolName = studentProfile ? studentProfile.school_name : '';
      const existingMentorId = studentProfile ? studentProfile.mentor_id : '';
      const existingTemplateId = studentProfile ? studentProfile.program_template_id : '';
      const existingStartDate = studentProfile ? studentProfile.start_date : '';
      const existingEndDate = studentProfile ? studentProfile.end_date : '';

      school_name_val = school_name !== undefined ? school_name : existingSchoolName;
      mentor_id_val = mentor_id !== undefined ? mentor_id : existingMentorId;
      program_template_id_val = program_template_id !== undefined ? program_template_id : existingTemplateId;
      start_date_val = start_date !== undefined ? start_date : existingStartDate;
      end_date_val = end_date !== undefined ? end_date : existingEndDate;

      if (!school_name_val || !mentor_id_val || !program_template_id_val || !start_date_val || !end_date_val) {
        return res.status(400).json({ error: 'Data profil PKL tidak lengkap' });
      }

      const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (start_date !== undefined && start_date_val > todayStr) {
        return res.status(400).json({ error: 'Tanggal mulai magang tidak boleh di masa depan' });
      }
    }

    let updateFields = 'nama_lengkap = ?, username = ?';
    let params = [nama_lengkap_val.trim(), username_val.trim().toLowerCase()];

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
      const allowedRoles = ['employee', 'student', 'mentor', 'admin'];
      const lowRole = role.toLowerCase();
      if (!allowedRoles.includes(lowRole)) {
        return res.status(400).json({ error: 'Role tidak valid' });
      }
      updateFields += ', role = ?, kategori = ?';
      params.push(lowRole, lowRole === 'student' ? 'PKL' : 'Karyawan');
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

    if (telegram_chat_id !== undefined) {
      const cleanChatId = telegram_chat_id.trim();
      if (cleanChatId === '') {
        updateFields += ', telegram_chat_id = ?, telegram_chat_name = NULL';
        params.push(null);
      } else {
        updateFields += ', telegram_chat_id = ?';
        params.push(cleanChatId);
      }
    }

    let generatedNoKaryawan = null;
    if (targetRole === 'employee' && (!user.no_karyawan || user.no_karyawan.trim() === '')) {
      generatedNoKaryawan = await generateNoKaryawan();
      updateFields += ', no_karyawan = ?';
      params.push(generatedNoKaryawan);
    }

    params.push(id);

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await pool.queryWithClient(client, `UPDATE users SET ${updateFields} WHERE id = ?`, params);

      if (targetRole === 'student') {
        const [studentRows] = await pool.queryWithClient(client, 'SELECT id FROM pkl_students WHERE user_id = ?', [id]);
        if (studentRows.length > 0) {
          await pool.queryWithClient(client,
            `UPDATE pkl_students 
             SET mentor_id = ?, program_template_id = ?, school_name = ?, start_date = ?, end_date = ?, status = 'ACTIVE' 
             WHERE user_id = ?`,
            [mentor_id_val, program_template_id_val, school_name_val.trim(), start_date_val, end_date_val, id]
          );
        } else {
          const studentProfileId = `std-${Date.now()}`;
          await pool.queryWithClient(client,
            `INSERT INTO pkl_students (id, user_id, mentor_id, program_template_id, school_name, start_date, end_date, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
            [studentProfileId, id, mentor_id_val, program_template_id_val, school_name_val.trim(), start_date_val, end_date_val]
          );
        }
      } else if (currentRole === 'student' && targetRole !== 'student') {
        await pool.queryWithClient(client,
          `UPDATE pkl_students SET status = 'ARCHIVED' WHERE user_id = ?`,
          [id]
        );
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error("Gagal memperbarui data pengguna & siswa:", dbErr);
      return res.status(500).json({ error: 'Gagal memperbarui data pengguna' });
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Gagal memperbarui pengguna:", error);
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
    // Wrap in a transaction to safely reassign students to admin and delete the user
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await pool.queryWithClient(client, 'UPDATE pkl_students SET mentor_id = ? WHERE mentor_id = ?', ['usr-admin', user.id]);
      await pool.queryWithClient(client, 'DELETE FROM users WHERE id = ?', [user.id]);
      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error("Gagal menghapus pengguna (transaksi DB):", dbErr);
      throw dbErr;
    } finally {
      client.release();
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Gagal menghapus pengguna (API error):", error);
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
      telegram_chat_id_kie: '',
      smtp_host: '',
      smtp_port: '587',
      smtp_user: '',
      smtp_pass: '',
      smtp_to: '',
      smtp_sender: '',
      payroll_approver_name: 'M. Firas Faisal',
      payroll_approver_role: 'Direktur Utama',
      show_pkl_scoreboard: '1',
      payroll_notice_text: '',
      payroll_notice_active: '0',
      payroll_notice_date: '',
      payroll_notice_template_id: '1'
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
      telegram_chat_id_kie,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      smtp_to,
      smtp_sender,
      payroll_approver_name,
      payroll_approver_role,
      show_pkl_scoreboard,
      payroll_notice_text,
      payroll_notice_active,
      payroll_notice_date,
      payroll_notice_template_id
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
      const latVal = office_latitude?.toString().replace(',', '.').trim();
      const lngVal = office_longitude?.toString().replace(',', '.').trim();
      
      if (latVal !== "" || lngVal !== "") {
        const parsedLat = parseFloat(latVal);
        const parsedLng = parseFloat(lngVal);
        
        if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
          return res.status(400).json({ error: 'Latitude kantor tidak valid. Harus berupa angka antara -90 dan 90.' });
        }
        if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
          return res.status(400).json({ error: 'Longitude kantor tidak valid. Harus berupa angka antara -180 dan 180.' });
        }
      }
      
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

      // Auto-register Telegram webhook on settings change if not localhost
      const host = req.headers['x-forwarded-host'] || req.get('host');
      if (tokenVal !== "" && host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        registerTelegramWebhook(tokenVal, host).catch(err => {
          console.error("Gagal registrasi Telegram Webhook secara otomatis saat save settings:", err);
        });
      }
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

    if (telegram_chat_id_kie !== undefined) {
      let chatIdVal = telegram_chat_id_kie.toString().trim();
      if (chatIdVal.startsWith('-') && !chatIdVal.startsWith('-100')) {
        chatIdVal = '-100' + chatIdVal.slice(1);
      }
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('telegram_chat_id_kie', ?) ON DUPLICATE KEY UPDATE key_value = ?",
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

    if (show_pkl_scoreboard !== undefined) {
      const val = show_pkl_scoreboard.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('show_pkl_scoreboard', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (payroll_notice_text !== undefined) {
      const val = payroll_notice_text.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('payroll_notice_text', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (payroll_notice_active !== undefined) {
      const val = payroll_notice_active.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('payroll_notice_active', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (payroll_notice_date !== undefined) {
      const val = payroll_notice_date.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('payroll_notice_date', ?) ON DUPLICATE KEY UPDATE key_value = ?",
        [val, val]
      );
    }

    if (payroll_notice_template_id !== undefined) {
      const val = payroll_notice_template_id.toString().trim();
      await pool.query(
        "INSERT INTO settings (key_name, key_value) VALUES ('payroll_notice_template_id', ?) ON DUPLICATE KEY UPDATE key_value = ?",
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
        payroll_approver_role,
        show_pkl_scoreboard,
        payroll_notice_text,
        payroll_notice_active,
        payroll_notice_date,
        payroll_notice_template_id
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
app.post('/api/users/update-profile', validateDeviceSession, async (req, res) => {
  try {
    const { foto_base64 } = req.body;
    if (!foto_base64) {
      return res.status(400).json({ error: 'Data update tidak lengkap' });
    }

    const user = req.user;
    const user_id = user.id;

    if (!foto_base64.startsWith('data:image')) {
      return res.status(400).json({ error: 'Format foto tidak valid' });
    }

    // 1. Hapus foto lama dari Supabase Storage jika ada
    const currentPhoto = user.foto_profile;
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
app.post('/api/users/update-bio', validateDeviceSession, async (req, res) => {
  try {
    const { tanggal_lahir, gender, alamat, jabatan, email, no_telp, kategori, password } = req.body;
    const user = req.user;
    const user_id = user.id;

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

// Helper to parse date string YYYY-MM-DD into a UTC date object representing the calendar date relative to Jakarta
function parseJakartaDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    const formatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(dateInput);
    const [y, m, d] = formatted.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const dateStr = typeof dateInput === 'string' ? dateInput : String(dateInput);
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const dObj = new Date(dateStr);
  const formatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(dObj);
  const [y, m, d] = formatted.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Helper to count weekdays (Monday-Friday) between two dates
function getWeekdaysCount(startDate, endDate) {
  let count = 0;
  let cur = new Date(startDate.getTime());
  while (cur.getTime() <= endDate.getTime()) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) { // Not Sunday or Saturday
      count++;
    }
    cur.setTime(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return count;
}

// Helper to calculate and synchronize student KIE API submission debt
async function syncUserKieDebt(userId) {
  try {
    const [userRows] = await pool.query(
      "SELECT id, role, created_at FROM users WHERE id = ?",
      [userId]
    );
    if (userRows.length === 0) return;
    
    const user = userRows[0];
    if (user.role !== 'student') return;

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const todayDate = parseJakartaDate(todayStr);

    // Determine calculation start date
    const regDate = parseJakartaDate(user.created_at || new Date());
    const systemStartDate = parseJakartaDate('2026-07-02');
    const startDate = regDate.getTime() < systemStartDate.getTime() ? systemStartDate : regDate;

    // Yesterday is the day before todayDate
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);

    let completedWeekdays = 0;
    if (startDate.getTime() <= yesterdayDate.getTime()) {
      completedWeekdays = getWeekdaysCount(startDate, yesterdayDate);
    }

    const totalTarget = completedWeekdays * 4;

    // Count all submissions from startDate up to now
    const startDateStr = startDate.toISOString().split('T')[0];
    const [subCountRows] = await pool.query(
      "SELECT COUNT(*) AS total_submissions FROM kie_submissions WHERE user_id = ? AND (submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ?",
      [userId, startDateStr]
    );
    const totalSubmissions = subCountRows[0].total_submissions || 0;

    const currentKieDebt = Math.max(0, totalTarget - totalSubmissions);

    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    await pool.query(
      "UPDATE users SET kie_debt = ?, last_kie_debt_date = ? WHERE id = ?",
      [currentKieDebt, yesterdayStr, userId]
    );
  } catch (err) {
    console.error("Gagal sinkronisasi hutang KIE untuk user:", userId, err);
  }
}

// 9.5 KIE API Submission
app.post('/api/kie/submit', validateDeviceSession, async (req, res) => {
  try {
    const { api_key } = req.body;
    const user = req.user;

    if (!api_key) {
      return res.status(400).json({ error: 'API key wajib diisi' });
    }

    const keyVal = api_key.toString().trim();
    if (keyVal.length !== 32) {
      return res.status(400).json({ error: 'API key harus memiliki panjang tepat 32 karakter' });
    }

    // 1. Insert into database
    await pool.query(
      'INSERT INTO kie_submissions (user_id, api_key) VALUES (?, ?)',
      [user.id, keyVal]
    );

    // 2. Sync user's KIE debt
    await syncUserKieDebt(user.id);

    // 3. Fetch updated stats
    const [finalRows] = await pool.query(
      "SELECT kie_debt FROM users WHERE id = ?",
      [user.id]
    );
    const [finalCountRows] = await pool.query(
      "SELECT COUNT(*) AS count_today FROM kie_submissions WHERE user_id = ? AND (submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date",
      [user.id]
    );
    const finalCountToday = finalCountRows[0].count_today || 0;
    const finalDebt = finalRows[0]?.kie_debt || 0;

    // 4. Send Telegram Notification in background if configured (do not await to keep API response instant)
    try {
      const [botTokenSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_bot_token'");
      const [chatIdKieSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_chat_id_kie'");
      const [chatIdDefaultSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_chat_id'");

      const botToken = botTokenSetting[0]?.key_value;
      const chatId = (chatIdKieSetting[0]?.key_value && chatIdKieSetting[0].key_value.trim() !== '')
        ? chatIdKieSetting[0].key_value.trim()
        : chatIdDefaultSetting[0]?.key_value;

      if (botToken && chatId && botToken.trim() !== '' && chatId.trim() !== '') {
        const text = `KIE API disetor oleh: ${user.nama_lengkap} (@${user.username || ''})\n\n${keyVal}`;
        sendTelegramMessage(botToken, chatId, text).catch(tgError => {
          console.error('Gagal mengirim notifikasi KIE ke Telegram (background):', tgError);
        });
      }
    } catch (dbSettingsError) {
      console.error('Gagal membaca setting Telegram untuk KIE:', dbSettingsError);
    }

    res.json({ 
      success: true, 
      message: 'KIE API key berhasil disetor', 
      count_today: finalCountToday,
      kie_debt: finalDebt
    });
  } catch (error) {
    console.error('Gagal menyetor KIE API key:', error);
    res.status(500).json({ error: 'Gagal menyetor KIE API key' });
  }
});

// Webhook endpoint to receive Telegram Bot messages
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;
    if (!update || !update.message) {
      return res.sendStatus(200);
    }

    const { chat, text, from, message_id } = update.message;
    if (!chat || !chat.id || !text) {
      return res.sendStatus(200);
    }

    const chatIdStr = chat.id.toString();
    const messageText = text.trim();

    let chatName = "";
    if (chat.title) {
      chatName = chat.title.trim();
    } else {
      chatName = [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim() || chat.username || "Private Chat";
    }

    // Fetch bot token from settings to reply
    const [botTokenSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_bot_token'");
    const botToken = botTokenSetting[0]?.key_value;
    if (!botToken || botToken.trim() === '') {
      console.warn("Telegram webhook received message but telegram_bot_token is not set.");
      return res.sendStatus(200);
    }

    // 2. Check if it's a registration command
    if (messageText.startsWith('/register')) {
      const match = messageText.match(/^\/register\s+(.+)$/i);
      if (!match) {
        await sendTelegramReply(botToken, chat.id, "⚠️ Format salah. Gunakan: /register [username_aplikasi]", message_id);
        return res.sendStatus(200);
      }
      const targetUsername = match[1].trim();

      // Find user by username
      const [userRows] = await pool.query(
        "SELECT id, username, nama_lengkap, role FROM users WHERE LOWER(username) = LOWER(?)",
        [targetUsername]
      );

      if (userRows.length === 0) {
        await sendTelegramReply(
          botToken, 
          chat.id, 
          `❌ Username "${targetUsername}" tidak ditemukan di sistem absensi.`, 
          message_id
        );
        return res.sendStatus(200);
      }

      const targetUser = userRows[0];
      // Update telegram_chat_id and telegram_chat_name for this user
      await pool.query(
        "UPDATE users SET telegram_chat_id = ?, telegram_chat_name = ? WHERE id = ?",
        [chatIdStr, chatName, targetUser.id]
      );

      await sendTelegramReply(
        botToken, 
        chat.id, 
        `✅ Berhasil! Grup ini sekarang terdaftar untuk siswa:\n👤 Nama: *${targetUser.nama_lengkap}*\n🏷️ Username: @${targetUser.username}`, 
        message_id
      );
      return res.sendStatus(200);
    }

    // 3. Extract candidate keys (32 characters, alphanumeric)
    const lines = messageText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const candidateKeys = lines.filter(line => line.length === 32 && /^[a-zA-Z0-9]+$/.test(line));

    // If no candidate keys, simply ignore the message (could be a general discussion in the group chat)
    if (candidateKeys.length === 0) {
      return res.sendStatus(200);
    }

    // 4. Identify user by telegram_chat_id or fallback to sender's Telegram username
    let [userRows] = await pool.query(
      "SELECT id, username, nama_lengkap, role, kie_debt, telegram_chat_name FROM users WHERE telegram_chat_id = ?",
      [chatIdStr]
    );

    // Fallback: If not registered by telegram_chat_id, check if sender's Telegram username exists in DB
    if (userRows.length === 0 && from && from.username) {
      const [fallbackRows] = await pool.query(
        "SELECT id, username, nama_lengkap, role, kie_debt, telegram_chat_name FROM users WHERE LOWER(username) = LOWER(?)",
        [from.username.trim()]
      );
      if (fallbackRows.length > 0) {
        userRows = fallbackRows;
        // Auto-register chat ID if this is a group chat
        await pool.query(
          "UPDATE users SET telegram_chat_id = ?, telegram_chat_name = ? WHERE id = ?",
          [chatIdStr, chatName, fallbackRows[0].id]
        );
      }
    }

    if (userRows.length === 0) {
      const senderInfo = from ? ` (@${from.username || ''})` : '';
      await sendTelegramReply(
        botToken,
        chat.id,
        `⚠️ Pengirim${senderInfo} belum terdaftar di sistem absensi.\nSilakan hubungi admin atau gunakan perintah \`/register [username_aplikasi]\` di grup ini.`,
        message_id
      );
      return res.sendStatus(200);
    }

    const targetUser = userRows[0];

    // Keep telegram_chat_name updated if it changed
    if (targetUser.telegram_chat_name !== chatName) {
      await pool.query(
        "UPDATE users SET telegram_chat_name = ? WHERE id = ?",
        [chatName, targetUser.id]
      );
    }

    // Sync user KIE debt first
    await syncUserKieDebt(targetUser.id);

    // Fetch refreshed user info
    const [refreshedRows] = await pool.query(
      "SELECT role, kie_debt FROM users WHERE id = ?",
      [targetUser.id]
    );
    const refreshedUser = refreshedRows[0];
    let currentDebt = refreshedUser?.kie_debt || 0;

    const reportLines = [];
    let successCount = 0;

    // Process keys
    for (const keyVal of candidateKeys) {
      // Check if key already exists (globally duplicate check)
      const [dupRows] = await pool.query(
        "SELECT id FROM kie_submissions WHERE api_key = ?",
        [keyVal]
      );

      if (dupRows.length > 0) {
        reportLines.push(`❌ \`${keyVal.slice(0, 8)}...${keyVal.slice(-4)}\` - Duplikat/Sudah disetor`);
        continue;
      }

      // Insert KIE submission
      await pool.query(
        'INSERT INTO kie_submissions (user_id, api_key) VALUES (?, ?)',
        [targetUser.id, keyVal]
      );

      successCount++;
      reportLines.push(`✅ \`${keyVal.slice(0, 8)}...${keyVal.slice(-4)}\` - Sukses`);
    }

    // Sync user KIE debt after inserting all new keys
    await syncUserKieDebt(targetUser.id);

    // Fetch refreshed user info
    const [refreshedRowsAfter] = await pool.query(
      "SELECT role, kie_debt FROM users WHERE id = ?",
      [targetUser.id]
    );
    const refreshedUserAfter = refreshedRowsAfter[0];
    const currentDebtAfter = refreshedUserAfter?.kie_debt || 0;

    // Get final stats
    const [finalCountRows] = await pool.query(
      "SELECT COUNT(*) AS count_today FROM kie_submissions WHERE user_id = ? AND (submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date",
      [targetUser.id]
    );
    const finalCountToday = finalCountRows[0].count_today || 0;

    // Build report message
    const reportText = `📊 *Laporan Setoran KIE*
👤 *Nama:* ${targetUser.nama_lengkap} (@${targetUser.username || ''})

${reportLines.join('\n')}

📈 Total setoran hari ini: *${finalCountToday}/5*
💳 Sisa hutang KIE: *${refreshedUserAfter.role === 'student' ? currentDebtAfter : 0}*`;

    await sendTelegramReply(botToken, chat.id, reportText, message_id);
    res.sendStatus(200);

  } catch (err) {
    console.error("Gagal memproses Telegram Webhook:", err);
    res.sendStatus(200);
  }
});

// Endpoint to manually trigger Telegram Webhook registration
app.post('/api/telegram/register-webhook', async (req, res) => {
  try {
    const [botTokenSetting] = await pool.query("SELECT key_value FROM settings WHERE key_name = 'telegram_bot_token'");
    const botToken = botTokenSetting[0]?.key_value;
    if (!botToken || botToken.trim() === '') {
      return res.status(400).json({ error: 'Telegram Bot Token belum diset di pengaturan.' });
    }
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const result = await registerTelegramWebhook(botToken, host);
    if (result.success) {
      res.json({ success: true, message: `Webhook berhasil didaftarkan ke https://${host}/api/telegram/webhook: ${result.message}` });
    } else {
      res.status(500).json({ error: `Gagal mendaftarkan webhook: ${result.message}` });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mendaftarkan webhook.' });
  }
});

// GET today count of KIE submissions for the user
app.get('/api/kie/today-count', validateDeviceSession, async (req, res) => {
  try {
    const user = req.user;
    
    // Sync debt first to catch up
    await syncUserKieDebt(user.id);

    // Fetch updated debt and today's submissions count
    const [userRows] = await pool.query("SELECT role, kie_debt, created_at FROM users WHERE id = ?", [user.id]);
    const [countRows] = await pool.query(
      "SELECT COUNT(*) AS count_today FROM kie_submissions WHERE user_id = ? AND (submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date",
      [user.id]
    );

    const [submissions] = await pool.query(
      "SELECT id, api_key, submitted_at FROM kie_submissions WHERE user_id = ? ORDER BY submitted_at DESC",
      [user.id]
    );

    res.json({ 
      success: true, 
      count_today: countRows[0].count_today || 0,
      kie_debt: userRows[0]?.role === 'student' ? (userRows[0]?.kie_debt || 0) : 0,
      created_at: userRows[0]?.created_at,
      submissions: submissions || []
    });
  } catch (error) {
    console.error('Gagal mengambil jumlah KIE hari ini:', error);
    res.status(500).json({ error: 'Gagal mengambil data' });
  }
});

// GET users with KIE submissions for Admin page (paginated)
app.get('/api/kie/admin/users-submissions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 3;
    const offset = (page - 1) * limit;
    const filter = req.query.filter || 'all';

    // 1. Catch-up sync KIE debt for all students first to ensure accurate debt values
    const [students] = await pool.query("SELECT id FROM users WHERE role = 'student'");
    for (const s of students) {
      await syncUserKieDebt(s.id);
    }

    // 2. Build dynamic queries based on filter
    let whereClause = "role IN ('student', 'employee', 'mentor')";
    if (filter === 'debt') {
      whereClause = "role = 'student' AND kie_debt > 0";
    } else if (filter === 'nodebt') {
      whereClause = "role = 'student' AND (kie_debt = 0 OR kie_debt IS NULL)";
    }

    // Count total matching users to support infinite scroll / pagination
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM users WHERE ${whereClause}`
    );
    const totalUsers = countRows[0].total;

    // Fetch page of users
    const [users] = await pool.query(
      `SELECT id, username, nama_lengkap, role, foto_profile, email, kie_debt, telegram_chat_id, telegram_chat_name, created_at 
       FROM users 
       WHERE ${whereClause} 
       ORDER BY nama_lengkap ASC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    if (users.length === 0) {
      return res.json({ users: [], hasMore: false, total: totalUsers });
    }

    // Get submissions for these users
    const userIds = users.map(u => u.id);
    const [submissions] = await pool.query(
      `SELECT id, user_id, api_key, submitted_at 
       FROM kie_submissions 
       WHERE user_id IN (?) 
       ORDER BY submitted_at DESC`,
      [userIds]
    );

    // Group submissions by user_id
    const submissionsMap = {};
    userIds.forEach(id => {
      submissionsMap[id] = [];
    });
    submissions.forEach(sub => {
      submissionsMap[sub.user_id].push(sub);
    });

    const result = users.map(u => ({
      ...u,
      submissions: submissionsMap[u.id] || []
    }));

    res.json({
      users: result,
      hasMore: offset + users.length < totalUsers,
      total: totalUsers
    });
  } catch (error) {
    console.error('Gagal mengambil data submissions admin KIE:', error);
    res.status(500).json({ error: 'Gagal mengambil data' });
  }
});

// PUT update KIE submission for Admin
app.put('/api/kie/admin/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { api_key } = req.body;
    if (!api_key || api_key.trim().length !== 32) {
      return res.status(400).json({ error: 'Kunci API harus tepat 32 karakter' });
    }
    const [subRows] = await pool.query('SELECT user_id FROM kie_submissions WHERE id = ?', [id]);
    if (subRows.length > 0) {
      const userId = subRows[0].user_id;
      await pool.query('UPDATE kie_submissions SET api_key = ? WHERE id = ?', [api_key.trim(), id]);
      await syncUserKieDebt(userId);
    }
    res.json({ success: true, message: 'API KIE berhasil diperbarui' });
  } catch (error) {
    console.error('Gagal memperbarui KIE submission:', error);
    res.status(500).json({ error: 'Gagal memperbarui data' });
  }
});

// DELETE KIE submission for Admin
app.delete('/api/kie/admin/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [subRows] = await pool.query('SELECT user_id FROM kie_submissions WHERE id = ?', [id]);
    if (subRows.length > 0) {
      const userId = subRows[0].user_id;
      await pool.query('DELETE FROM kie_submissions WHERE id = ?', [id]);
      await syncUserKieDebt(userId);
    }
    res.json({ success: true, message: 'API KIE berhasil dihapus' });
  } catch (error) {
    console.error('Gagal menghapus KIE submission:', error);
    res.status(500).json({ error: 'Gagal menghapus data' });
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
      WHERE u.role = 'employee' AND u.is_active = 1
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

// Get next slip number sequence
app.get('/api/payroll/next-slip-no', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Bulan dan Tahun wajib disertakan' });
    }

    const [rows] = await pool.query('SELECT slip_no FROM payroll_slips');
    let maxIncrement = 37; // Start sequence at 38 if no existing higher sequence is found

    rows.forEach(r => {
      // Format: SLIP/X<number>/<month>/<year>
      const match = r.slip_no.match(/SLIP\/X(\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxIncrement) {
          maxIncrement = val;
        }
      }
    });

    const nextIncrement = maxIncrement + 1;
    const formattedMonth = String(month).padStart(2, '0');
    const nextSlipNo = `SLIP/X${nextIncrement}/${formattedMonth}/${year}`;

    res.json({ nextSlipNo });
  } catch (error) {
    console.error('Gagal mendapatkan nomor slip berikutnya:', error);
    res.status(500).json({ error: 'Gagal mendapatkan nomor slip berikutnya' });
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
    const [userRows] = await pool.query('SELECT username, nama_lengkap, role FROM users WHERE id = ?', [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    if (userRows[0].role !== 'employee') {
      return res.status(400).json({ error: 'Payroll hanya diperuntukkan bagi karyawan (employee)' });
    }
    const { username, nama_lengkap } = userRows[0];

    // Get user's jabatan
    const [configRows] = await pool.query('SELECT COALESCE(jabatan, \'Karyawan\') as jabatan FROM payroll_config WHERE user_id = ?', [user_id]);
    const jabatan = configRows.length > 0 ? configRows[0].jabatan : 'Karyawan';

    const slipId = `slip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let transferProofUrl = null;
    if (req.body.transfer_proof_base64) {
      try {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        transferProofUrl = await uploadFileToSupabase(
          req.body.transfer_proof_base64,
          'transfer-proofs',
          `transfer-${user_id}-${periode.replace(/\s+/g, '-')}`,
          allowedMimes,
          maxSize
        );
      } catch (uploadErr) {
        console.error("Gagal mengunggah bukti transfer:", uploadErr);
        return res.status(400).json({ error: `Gagal mengunggah bukti transfer: ${uploadErr.message}` });
      }
    }

    await pool.query(`
      INSERT INTO payroll_slips (
        id, user_id, username, nama_lengkap, periode, slip_no, tanggal_cetak,
        hari_kantor, hari_remote, hari_sakit, hari_izin, hari_alpha,
        gaji_pokok, tunjangan_makan, tunjangan_transport, potongan_alpha,
        potongan_sakit, potongan_izin, total_pendapatan, total_potongan, gaji_bersih, status, jabatan, bonus, transfer_proof
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      slipId, user_id, username, nama_lengkap, periode, slip_no, tanggal_cetak,
      hari_kantor || 0, hari_remote || 0, hari_sakit || 0, hari_izin || 0, hari_alpha || 0,
      gaji_pokok || 0, tunjangan_makan || 0, tunjangan_transport || 0, potongan_alpha || 0,
      potongan_sakit || 0, potongan_izin || 0, total_pendapatan || 0, total_potongan || 0, gaji_bersih || 0,
      status || 'Dibayar', jabatan, bonus || 0, transferProofUrl
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
app.post('/api/remote/requests', validateDeviceSession, async (req, res) => {
  try {
    const { alasan } = req.body;
    if (!alasan) {
      return res.status(400).json({ error: 'Alasan wajib disertakan' });
    }

    const user = req.user;
    const user_id = user.id;

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
app.post('/api/remote/requests/:id/cancel', validateDeviceSession, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const user_id = user.id;
    const role = user.role;
    if (!id) {
      return res.status(400).json({ error: 'ID wajib disertakan' });
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
app.post('/api/remote/requests/:id/report', validateDeviceSession, async (req, res) => {
  try {
    const { id } = req.params;
    const { report_content, attachment_base64, attachments_base64 } = req.body;
    if (!id || !report_content) {
      return res.status(400).json({ error: 'ID dan isi laporan wajib disertakan' });
    }

    const user = req.user;
    const user_id = user.id;

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
    let attachmentUrls = [];
    const uploadedUrls = [];

    // Support multiple attachments array uploaded in parallel with rollback
    if (attachments_base64 && Array.isArray(attachments_base64)) {
      try {
        const uploadPromises = attachments_base64.map(async (base64, i) => {
          if (!base64 || base64.trim() === '') return null;
          
          const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const filePrefix = `report-${user_id}-${uniqueId}-${i}`;
          
          const url = await uploadFileToSupabase(
            base64,
            UPLOAD_CONFIG.BUCKET_NAME,
            filePrefix,
            UPLOAD_CONFIG.ALLOWED_MIME_TYPES,
            UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES
          );
          
          uploadedUrls.push(url);
          return url;
        });
        
        const results = await Promise.all(uploadPromises);
        attachmentUrls = results.filter(url => url !== null);
      } catch (uploadErr) {
        if (uploadedUrls.length > 0) {
          console.warn(`Rollback triggered. Menghapus ${uploadedUrls.length} file yang sempat terunggah ke Supabase...`);
          await Promise.all(uploadedUrls.map(url => deleteFileFromSupabaseUrl(url, UPLOAD_CONFIG.BUCKET_NAME)));
        }
        return res.status(400).json({ error: `Gagal mengunggah lampiran: ${uploadErr.message}` });
      }
    } else if (attachment_base64 && attachment_base64.trim() !== '') {
      // Support backward compatibility for single attachment
      try {
        const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const url = await uploadFileToSupabase(
          attachment_base64, 
          UPLOAD_CONFIG.BUCKET_NAME, 
          `report-${user_id}-${uniqueId}`, 
          UPLOAD_CONFIG.ALLOWED_MIME_TYPES, 
          UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES
        );
        attachmentUrls.push(url);
      } catch (uploadErr) {
        return res.status(400).json({ error: `Gagal mengunggah lampiran: ${uploadErr.message}` });
      }
    }

    const reportAttachmentValue = attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : null;

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
      [report_content, reportAttachmentValue, id, user_id]
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
      attachmentUrl: reportAttachmentValue,
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
      
      const attachments = parseReportAttachments(r.report_attachment);
      const singleUrl = attachments[0] || null;
      
      return {
        ...r,
        logical_status: isExpired ? 'EXPIRED' : r.status,
        report_attachment_url: singleUrl,
        report_attachments: attachments
      };
    });

    res.json({ requests: mapped, total: totalCount });
  } catch (error) {
    console.error('Error fetching admin WFH logs:', error);
    res.status(500).json({ error: 'Gagal mengambil data riwayat remote' });
  }
});

// ==========================================
// ADMIN PKL CURRICULUM INPUT ENDPOINTS
// ==========================================

app.post('/api/pkl-templates', async (req, res) => {
  try {
    const { title, duration_months } = req.body;
    if (!title || !duration_months) {
      return res.status(400).json({ error: 'Title dan durasi wajib diisi' });
    }
    const id = 'tmpl-' + Math.random().toString(36).substr(2, 9);
    await pool.query('INSERT INTO pkl_program_templates (id, title, duration_months) VALUES (?, ?, ?)', [id, title, parseInt(duration_months)]);
    res.json({ success: true, data: { id, title, duration_months } });
  } catch (error) {
    console.error('Gagal membuat template:', error);
    res.status(500).json({ error: 'Gagal membuat template' });
  }
});

app.delete('/api/pkl-templates/:id', async (req, res) => {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const templateId = req.params.id;
    const [weeks] = await pool.queryWithClient(client, 'SELECT id FROM pkl_program_weeks WHERE template_id = ?', [templateId]);
    const weekIds = weeks.map(w => w.id);
    if (weekIds.length > 0) {
      await pool.queryWithClient(client, 'DELETE FROM pkl_program_tasks WHERE week_id IN (?)', [weekIds]);
      await pool.queryWithClient(client, 'DELETE FROM pkl_program_weeks WHERE template_id = ?', [templateId]);
    }
    await pool.queryWithClient(client, 'UPDATE pkl_students SET program_template_id = NULL WHERE program_template_id = ?', [templateId]);
    await pool.queryWithClient(client, 'DELETE FROM pkl_program_templates WHERE id = ?', [templateId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Gagal menghapus template:', error);
    res.status(500).json({ error: 'Gagal menghapus template' });
  } finally {
    client.release();
  }
});

app.get('/api/pkl-templates/:templateId/weeks', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, template_id, week_number, month_number, milestone_title, progress_percent FROM pkl_program_weeks WHERE template_id = ? ORDER BY month_number ASC, week_number ASC', [req.params.templateId]);
    res.json(rows);
  } catch (error) {
    console.error('Gagal mengambil data minggu:', error);
    res.status(500).json({ error: 'Gagal mengambil data minggu' });
  }
});

app.post('/api/pkl-templates/:templateId/weeks', async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const { week_number, month_number, milestone_title } = req.body;
    if (!week_number || !month_number || !milestone_title) {
      return res.status(400).json({ error: 'Week number, month number, dan milestone title wajib diisi' });
    }
    const id = 'wk-' + Math.random().toString(36).substr(2, 9);
    await pool.query('INSERT INTO pkl_program_weeks (id, template_id, week_number, month_number, milestone_title, progress_percent) VALUES (?, ?, ?, ?, ?, 0)', 
      [id, templateId, parseInt(week_number), parseInt(month_number), milestone_title]
    );
    res.json({ success: true, data: { id, template_id: templateId, week_number, month_number, milestone_title, progress_percent: 0 } });
  } catch (error) {
    console.error('Gagal membuat data minggu:', error);
    res.status(500).json({ error: 'Gagal membuat data minggu' });
  }
});

app.put('/api/pkl-weeks/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { week_number, month_number, milestone_title, progress_percent } = req.body;
    if (!week_number || !month_number || !milestone_title) {
      return res.status(400).json({ error: 'Week number, month number, dan milestone title wajib diisi' });
    }
    const progress = progress_percent !== undefined ? Math.min(100, Math.max(0, parseInt(progress_percent) || 0)) : 0;
    await pool.query(
      'UPDATE pkl_program_weeks SET week_number = ?, month_number = ?, milestone_title = ?, progress_percent = ? WHERE id = ?',
      [parseInt(week_number), parseInt(month_number), milestone_title, progress, id]
    );
    res.json({ success: true, data: { id, week_number, month_number, milestone_title, progress_percent: progress } });
  } catch (error) {
    console.error('Gagal memperbarui data minggu:', error);
    res.status(500).json({ error: 'Gagal memperbarui data minggu' });
  }
});

app.delete('/api/pkl-weeks/:id', async (req, res) => {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const weekId = req.params.id;
    await pool.queryWithClient(client, 'DELETE FROM pkl_program_tasks WHERE week_id = ?', [weekId]);
    await pool.queryWithClient(client, 'DELETE FROM pkl_program_weeks WHERE id = ?', [weekId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Gagal menghapus minggu:', error);
    res.status(500).json({ error: 'Gagal menghapus minggu' });
  } finally {
    client.release();
  }
});

app.get('/api/pkl-weeks/:weekId/tasks', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, week_id, task_title, is_mandatory FROM pkl_program_tasks WHERE week_id = ? ORDER BY id ASC', [req.params.weekId]);
    res.json(rows);
  } catch (error) {
    console.error('Gagal mengambil data tugas:', error);
    res.status(500).json({ error: 'Gagal mengambil data tugas' });
  }
});

app.post('/api/pkl-weeks/:weekId/tasks', async (req, res) => {
  try {
    const weekId = req.params.weekId;
    const { task_title, is_mandatory } = req.body;
    if (!task_title) {
      return res.status(400).json({ error: 'Task title wajib diisi' });
    }
    const id = 'tsk-' + Math.random().toString(36).substr(2, 9);
    await pool.query('INSERT INTO pkl_program_tasks (id, week_id, task_title, is_mandatory) VALUES (?, ?, ?, ?)', 
      [id, weekId, task_title, is_mandatory ? 1 : 0]
    );
    res.json({ success: true, data: { id, week_id: weekId, task_title, is_mandatory } });
  } catch (error) {
    console.error('Gagal membuat data tugas:', error);
    res.status(500).json({ error: 'Gagal membuat data tugas' });
  }
});

app.delete('/api/pkl-tasks/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM pkl_program_tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Gagal menghapus tugas:', error);
    res.status(500).json({ error: 'Gagal menghapus tugas' });
  }
});

// ==========================================
// Dress Code & Aspect Settings API
// ==========================================

app.get('/api/pkl-dress-code', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT day_number, day_name, clothes_description FROM pkl_dress_code ORDER BY day_number ASC');
    res.json(rows);
  } catch (error) {
    console.error('Gagal mengambil jadwal pakaian:', error);
    res.status(500).json({ error: 'Gagal mengambil jadwal pakaian' });
  }
});

app.put('/api/pkl-dress-code', async (req, res) => {
  try {
    const { day_number, clothes_description } = req.body;
    if (day_number === undefined || !clothes_description) {
      return res.status(400).json({ error: 'Data tidak lengkap' });
    }
    await pool.query('UPDATE pkl_dress_code SET clothes_description = ? WHERE day_number = ?', [clothes_description, day_number]);
    res.json({ success: true });
  } catch (error) {
    console.error('Gagal menyimpan jadwal pakaian:', error);
    res.status(500).json({ error: 'Gagal menyimpan jadwal pakaian' });
  }
});

app.get('/api/pkl-aspect-settings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT aspect_key, label, icon_name, is_active FROM pkl_aspect_settings ORDER BY aspect_key ASC');
    res.json(rows);
  } catch (error) {
    console.error('Gagal mengambil pengaturan aspek:', error);
    res.status(500).json({ error: 'Gagal mengambil pengaturan aspek' });
  }
});

app.put('/api/pkl-aspect-settings', async (req, res) => {
  try {
    const { aspect_key, label, icon_name, is_active } = req.body;
    if (!aspect_key || !label || !icon_name || is_active === undefined) {
      return res.status(400).json({ error: 'Data tidak lengkap' });
    }
    await pool.query(
      'UPDATE pkl_aspect_settings SET label = ?, icon_name = ?, is_active = ? WHERE aspect_key = ?',
      [label, icon_name, is_active ? 1 : 0, aspect_key]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Gagal menyimpan pengaturan aspek:', error);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan aspek' });
  }
});

// ==========================================
// PKL Activity Routes & Global Error Handler
// ==========================================

const pklActivityRouter = require('./src/modules/pkl-activity/routes');
const swaggerUi = require('swagger-ui-express');
const openapiDocument = require('./src/docs/openapi.json');

// Mount Swagger UI under /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// Mount router under /api/v1
app.use('/api/v1', pklActivityRouter);

// ══════════════════════════════════════════════════════════════════════════════
// CERTIFICATE GRADE API ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── Helper: Count working days (Mon-Fri) in a date range ─────────────────────
function countWorkingDays(startDate, endDate) {
  let count = 0;
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── GET /api/cert-settings/:curriculumId ─────────────────────────────────────
app.get('/api/cert-settings/:curriculumId', async (req, res) => {
  try {
    const { curriculumId } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM cert_curriculum_settings WHERE curriculum_id = ? LIMIT 1',
      [curriculumId]
    );
    if (rows.length === 0) {
      // Return defaults if not yet configured
      return res.json({ curriculum_id: curriculumId, activity_weight: 50, kie_weight: 50, aspect_label: 'Kedisiplinan' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/cert-settings error:', err);
    res.status(500).json({ error: 'Gagal mengambil pengaturan sertifikat' });
  }
});

// ── PUT /api/cert-settings/:curriculumId ─────────────────────────────────────
app.put('/api/cert-settings/:curriculumId', async (req, res) => {
  try {
    const { curriculumId } = req.params;
    const { activity_weight, kie_weight, aspect_label } = req.body;
    if (activity_weight + kie_weight !== 100) {
      return res.status(400).json({ error: 'Jumlah bobot aktivitas dan KIE harus 100%' });
    }
    await pool.query(
      `INSERT INTO cert_curriculum_settings (curriculum_id, activity_weight, kie_weight, aspect_label, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (curriculum_id) DO UPDATE SET
         activity_weight = EXCLUDED.activity_weight,
         kie_weight = EXCLUDED.kie_weight,
         aspect_label = EXCLUDED.aspect_label,
         updated_at = CURRENT_TIMESTAMP`,
      [curriculumId, activity_weight, kie_weight, aspect_label]
    );
    res.json({ success: true, message: 'Pengaturan sertifikat berhasil disimpan' });
  } catch (err) {
    console.error('PUT /api/cert-settings error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan sertifikat' });
  }
});

// ── GET /api/cert-criteria ────────────────────────────────────────────────────
app.get('/api/cert-criteria', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM cert_grade_criteria ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/cert-criteria error:', err);
    res.status(500).json({ error: 'Gagal mengambil kriteria penilaian' });
  }
});

// ── POST /api/cert-criteria ───────────────────────────────────────────────────
app.post('/api/cert-criteria', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nama kriteria wajib diisi' });
    const [result] = await pool.query(
      'INSERT INTO cert_grade_criteria (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM cert_grade_criteria t2))',
      [name.trim()]
    );
    res.json({ success: true, id: result.insertId, message: 'Kriteria berhasil ditambahkan' });
  } catch (err) {
    console.error('POST /api/cert-criteria error:', err);
    res.status(500).json({ error: 'Gagal menambahkan kriteria' });
  }
});

// ── PUT /api/cert-criteria/:id ────────────────────────────────────────────────
app.put('/api/cert-criteria/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    await pool.query(
      'UPDATE cert_grade_criteria SET name = COALESCE(?, name), is_active = COALESCE(?, is_active) WHERE id = ?',
      [name ?? null, is_active ?? null, id]
    );
    res.json({ success: true, message: 'Kriteria berhasil diperbarui' });
  } catch (err) {
    console.error('PUT /api/cert-criteria error:', err);
    res.status(500).json({ error: 'Gagal memperbarui kriteria' });
  }
});

// ── DELETE /api/cert-criteria/:id ─────────────────────────────────────────────
app.delete('/api/cert-criteria/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM cert_grade_criteria WHERE id = ?', [id]);
    res.json({ success: true, message: 'Kriteria berhasil dihapus' });
  } catch (err) {
    console.error('DELETE /api/cert-criteria error:', err);
    res.status(500).json({ error: 'Gagal menghapus kriteria' });
  }
});

// ── POST /api/cert-criterion-scores ──────────────────────────────────────────
// Batch upsert criterion scores for one month
// Body: { student_id, curriculum_id, month_number, notes, scores: { criterion_id: score } }
app.post('/api/cert-criterion-scores', async (req, res) => {
  try {
    const { student_id, curriculum_id, month_number, notes, scores } = req.body;
    if (!student_id || !curriculum_id || !month_number || !scores) {
      return res.status(400).json({ error: 'student_id, curriculum_id, month_number, dan scores wajib diisi' });
    }

    // Upsert each criterion score
    for (const [criterionId, score] of Object.entries(scores)) {
      const numScore = parseFloat(String(score));
      if (isNaN(numScore) || numScore < 0 || numScore > 10) continue;
      await pool.query(
        `INSERT INTO cert_criterion_scores (student_id, curriculum_id, month_number, criterion_id, score, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (student_id, curriculum_id, month_number, criterion_id) DO UPDATE SET
           score = EXCLUDED.score,
           updated_at = CURRENT_TIMESTAMP`,
        [student_id, curriculum_id, month_number, parseInt(criterionId), numScore]
      );
    }

    // Also upsert notes in cert_monthly_grades
    if (notes !== undefined) {
      // Compute avg score for that month to store as summary
      const [avgRows] = await pool.query(
        `SELECT AVG(score) as avg_score FROM cert_criterion_scores
         WHERE student_id = ? AND curriculum_id = ? AND month_number = ?`,
        [student_id, curriculum_id, month_number]
      );
      const avgScore = avgRows[0]?.avg_score ?? 0;
      await pool.query(
        `INSERT INTO cert_monthly_grades (student_id, curriculum_id, month_number, activity_score, notes, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (student_id, curriculum_id, month_number) DO UPDATE SET
           activity_score = EXCLUDED.activity_score,
           notes = EXCLUDED.notes,
           updated_at = CURRENT_TIMESTAMP`,
        [student_id, curriculum_id, month_number, avgScore, notes || null]
      );
    }

    res.json({ success: true, message: `Nilai Bulan ${month_number} berhasil disimpan` });
  } catch (err) {
    console.error('POST /api/cert-criterion-scores error:', err);
    res.status(500).json({ error: 'Gagal menyimpan nilai kriteria' });
  }
});

// ── GET /api/cert-grades ─────────────────────────────────────────────────────
// Returns monthly grades with multi-criteria scores and KIE completion data
app.get('/api/cert-grades', async (req, res) => {
  try {
    const { student_id, curriculum_id } = req.query;
    if (!student_id || !curriculum_id) {
      return res.status(400).json({ error: 'student_id dan curriculum_id wajib diisi' });
    }

    // Get student info (start/end dates for duration)
    const [studentRows] = await pool.query(
      'SELECT s.id, u.id as user_id, s.start_date, s.end_date FROM pkl_students s JOIN users u ON u.id = s.user_id WHERE s.id = ? LIMIT 1',
      [student_id]
    );
    if (studentRows.length === 0) {
      return res.status(404).json({ error: 'Siswa tidak ditemukan' });
    }
    const student = studentRows[0];

    const formatDateStr = (d) => {
      if (!d) return null;
      if (d instanceof Date) {
        const offset = d.getTimezoneOffset() * 60000;
        const local = new Date(d.getTime() - offset);
        return local.toISOString().split('T')[0];
      }
      return String(d).split('T')[0];
    };
    const startStr = formatDateStr(student.start_date);
    const endStr = formatDateStr(student.end_date);

    const addMonths = (dateStr, months) => {
      const parts = dateStr.split('-');
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]) - 1;
      const d = parseInt(parts[2]);
      const targetDate = new Date(y, m + months, d);
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const subtractOneDay = (dateStr) => {
      const d = new Date(dateStr);
      d.setDate(d.getDate() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const addOneDay = (dateStr) => {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Get curriculum settings
    const [settingsRows] = await pool.query(
      'SELECT * FROM cert_curriculum_settings WHERE curriculum_id = ? LIMIT 1',
      [curriculum_id]
    );
    const settings = settingsRows[0] || { activity_weight: 50, kie_weight: 50, aspect_label: 'Kedisiplinan' };

    // Get all active criteria
    const [criteriaRows] = await pool.query(
      'SELECT id, name, sort_order FROM cert_grade_criteria WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );

    // Get all criterion scores for this student+curriculum
    const [scoreRows] = await pool.query(
      'SELECT month_number, criterion_id, score FROM cert_criterion_scores WHERE student_id = ? AND curriculum_id = ?',
      [student_id, curriculum_id]
    );
    // Build scoreMap: month_number → { criterion_id → score }
    const scoreMap = {};
    scoreRows.forEach(s => {
      if (!scoreMap[s.month_number]) scoreMap[s.month_number] = {};
      scoreMap[s.month_number][s.criterion_id] = parseFloat(s.score);
    });

    // Get notes from cert_monthly_grades
    const [gradeRows] = await pool.query(
      'SELECT month_number, notes FROM cert_monthly_grades WHERE student_id = ? AND curriculum_id = ?',
      [student_id, curriculum_id]
    );
    const notesMap = {};
    gradeRows.forEach(g => { notesMap[g.month_number] = g.notes; });

    // Build monthly intervals starting from start_date
    const months = [];
    let curStart = startStr;
    let m = 1;

    while (curStart <= endStr) {
      const nextMonthStr = addMonths(startStr, m);
      const curEnd = subtractOneDay(nextMonthStr);
      const actualEnd = curEnd < endStr ? curEnd : endStr;

      // KIE for this month range
      const [kieCountRows] = await pool.query(
        `SELECT COUNT(*) as total FROM kie_submissions k
         JOIN users u ON u.id = k.user_id
         JOIN pkl_students ps ON ps.user_id = u.id
         WHERE ps.id = ?
           AND (k.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ?
           AND (k.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ?`,
        [student_id, curStart, actualEnd]
      );
      const kieSubmitted = parseInt(kieCountRows[0]?.total || 0);
      const workingDays = countWorkingDays(new Date(curStart), new Date(actualEnd));
      const kieTarget = workingDays * 4;
      const kiePct = kieTarget > 0 ? Math.min(100, (kieSubmitted / kieTarget) * 100) : 0;

      // Criterion scores for this month
      const monthScores = scoreMap[m] || {};
      const filledScores = criteriaRows.map(c => monthScores[c.id] ?? null).filter(v => v !== null);
      const activityAvg = filledScores.length > 0
        ? filledScores.reduce((s, v) => s + v, 0) / filledScores.length
        : null;

      // Monthly accumulation is now simply the activity average (excluding KIE)
      let accumulation = null;
      if (activityAvg !== null) {
        accumulation = activityAvg;
      }

      months.push({
        month_number: m,
        month_label: `Bulan ${m}`,
        month_start: curStart,
        month_end: actualEnd,
        criteria_scores: monthScores,
        activity_avg: activityAvg !== null ? Math.round(activityAvg * 100) / 100 : null,
        notes: notesMap[m] || null,
        kie_submitted: kieSubmitted,
        kie_target: kieTarget,
        kie_pct: Math.round(kiePct * 100) / 100,
        working_days: workingDays,
        accumulation: accumulation !== null ? Math.round(accumulation * 100) / 100 : null,
      });

      curStart = addOneDay(actualEnd);
      m++;
      if (curStart > endStr || m > 24) {
        break;
      }
    }
    const numMonths = months.length;

    // Per-criterion averages across all months (for summary row)
    const criteriaAverages = {};
    criteriaRows.forEach(c => {
      const vals = months.map(mo => mo.criteria_scores[c.id] ?? null).filter(v => v !== null);
      criteriaAverages[c.id] = vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
        : null;
    });

    // Final certificate grade: average of monthly accumulations
    const filledMonths = months.filter(mo => mo.accumulation !== null);
    const finalGrade = filledMonths.length > 0
      ? Math.round((filledMonths.reduce((s, mo) => s + mo.accumulation, 0) / filledMonths.length) * 100) / 100
      : null;

    const totalKieSubmitted = months.reduce((sum, mo) => sum + mo.kie_submitted, 0);
    const totalKieTarget = months.reduce((sum, mo) => sum + mo.kie_target, 0);
    const kieOverallPct = totalKieTarget > 0 ? Math.round((totalKieSubmitted / totalKieTarget) * 10000) / 100 : 0;
    res.json({
      student_id,
      curriculum_id,
      num_months: numMonths,
      start_date: student.start_date,
      end_date: student.end_date,
      settings,
      criteria: criteriaRows,
      months,
      criteria_averages: criteriaAverages,
      final_grade: finalGrade,
      total_kie_submitted: totalKieSubmitted,
      total_kie_target: totalKieTarget,
      kie_overall_pct: kieOverallPct,
    });
  } catch (err) {
    console.error('GET /api/cert-grades error:', err);
    res.status(500).json({ error: 'Gagal mengambil data nilai sertifikat' });
  }
});


// ── GET /api/cert-tags ────────────────────────────────────────────────────────
app.get('/api/cert-tags', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM cert_appreciation_tags ORDER BY sort_order ASC, id ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/cert-tags error:', err);
    res.status(500).json({ error: 'Gagal mengambil daftar tag' });
  }
});

// ── POST /api/cert-tags ───────────────────────────────────────────────────────
app.post('/api/cert-tags', async (req, res) => {
  try {
    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Label tag wajib diisi' });
    const [result] = await pool.query(
      'INSERT INTO cert_appreciation_tags (label, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM cert_appreciation_tags t2))',
      [label.trim()]
    );
    res.json({ success: true, id: result.insertId, message: 'Tag berhasil ditambahkan' });
  } catch (err) {
    console.error('POST /api/cert-tags error:', err);
    res.status(500).json({ error: 'Gagal menambahkan tag' });
  }
});

// ── PUT /api/cert-tags/:id ────────────────────────────────────────────────────
app.put('/api/cert-tags/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { label, is_active } = req.body;
    await pool.query(
      'UPDATE cert_appreciation_tags SET label = COALESCE(?, label), is_active = COALESCE(?, is_active) WHERE id = ?',
      [label ?? null, is_active ?? null, id]
    );
    res.json({ success: true, message: 'Tag berhasil diperbarui' });
  } catch (err) {
    console.error('PUT /api/cert-tags error:', err);
    res.status(500).json({ error: 'Gagal memperbarui tag' });
  }
});

// ── DELETE /api/cert-tags/:id ─────────────────────────────────────────────────
app.delete('/api/cert-tags/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM cert_appreciation_tags WHERE id = ?', [id]);
    res.json({ success: true, message: 'Tag berhasil dihapus' });
  } catch (err) {
    console.error('DELETE /api/cert-tags error:', err);
    res.status(500).json({ error: 'Gagal menghapus tag' });
  }
});

// ── GET /api/cert-student-tags ────────────────────────────────────────────────
app.get('/api/cert-student-tags', async (req, res) => {
  try {
    const { student_id, curriculum_id } = req.query;
    const [rows] = await pool.query(
      `SELECT cst.tag_id, cat.label FROM cert_student_tags cst
       JOIN cert_appreciation_tags cat ON cat.id = cst.tag_id
       WHERE cst.student_id = ? AND cst.curriculum_id = ?`,
      [student_id, curriculum_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/cert-student-tags error:', err);
    res.status(500).json({ error: 'Gagal mengambil tag siswa' });
  }
});

// ── PUT /api/cert-student-tags ────────────────────────────────────────────────
// Replace all selected tags for a student
app.put('/api/cert-student-tags', async (req, res) => {
  try {
    const { student_id, curriculum_id, tag_ids } = req.body;
    if (!student_id || !curriculum_id) {
      return res.status(400).json({ error: 'student_id dan curriculum_id wajib diisi' });
    }
    // Delete existing then re-insert
    await pool.query(
      'DELETE FROM cert_student_tags WHERE student_id = ? AND curriculum_id = ?',
      [student_id, curriculum_id]
    );
    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      const values = tag_ids.map(tid => [student_id, curriculum_id, tid]);
      await pool.query(
        'INSERT INTO cert_student_tags (student_id, curriculum_id, tag_id) VALUES ?',
        [values]
      );
    }
    res.json({ success: true, message: 'Tag siswa berhasil diperbarui' });
  } catch (err) {
    console.error('PUT /api/cert-student-tags error:', err);
    res.status(500).json({ error: 'Gagal memperbarui tag siswa' });
  }
});

// Global Error Handler for PKL Activity

app.use((err, req, res, next) => {
  console.error('Express App Caught Error:', err);

  let statusCode = 500;
  let errorCode = 'SERVER_ERROR';
  let message = err.message || 'Terjadi kesalahan internal server';
  let details = [];

  if (err.code === 'INVALID_INPUT') {
    statusCode = 400;
    errorCode = 'INVALID_INPUT';
    message = err.message || 'Validasi data masukan gagal.';
    details = err.details || [];
  } else if (err.code === 'FORBIDDEN') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = err.message || 'Anda tidak memiliki akses ke resource ini';
  } else if (err.code === 'NOT_FOUND') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = err.message || 'Resource tidak ditemukan';
  } else if (err.code === 'DAILY_SESSION_LOCKED') {
    statusCode = 400;
    errorCode = 'DAILY_SESSION_LOCKED';
    message = err.message || 'Sesi evaluasi harian sudah terkunci';
  }

  res.status(statusCode).json({
    status: 'error',
    error: {
      code: errorCode,
      message,
      details
    }
  });
});


if (process.env.VERCEL) {
  initDb().catch(err => console.error("Gagal melakukan inisialisasi basis data PostgreSQL di Vercel:", err));
} else {
  app.listen(PORT, () => {
    console.log(`Server Express backend berjalan pada http://localhost:${PORT}`);
    initDb().catch(err => console.error("Gagal melakukan inisialisasi basis data:", err));
  });
}

app.pool = pool;
module.exports = app;
