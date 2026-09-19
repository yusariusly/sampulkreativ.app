const crypto = require('crypto');

// Deriving a 32-byte key using SHA-256 from the secret string
const SECRET_KEY = process.env.ABSENSI_CRYPTO_SECRET || 'sampulkreativ-super-secret-key-2026-absensi-token';
const ALGORITHM = 'aes-256-cbc';

function getKey() {
  return crypto.createHash('sha256').update(SECRET_KEY).digest();
}

function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(16);
    const key = getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption failed:', err);
    return '';
  }
}

function decrypt(text) {
  if (!text) return null;
  try {
    // If the text does not contain the delimiter, it's not our encrypted token (e.g. plaintext fallback)
    if (!text.includes(':')) {
      return null;
    }
    const parts = text.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}

/**
 * Menghasilkan token sesi terenkripsi yang aman untuk integrasi eksternal (misal: Aplikasi Manajemen Proyek)
 * Valid selama 30 hari.
 */
function generateSessionToken(user) {
  if (!user) return '';
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    issuedAt: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 hari
  };
  const cipher = encrypt(JSON.stringify(payload));
  return 'sk_sec_' + Buffer.from(cipher).toString('base64url');
}

/**
 * Memverifikasi token sesi dari aplikasi eksternal
 */
function verifySessionToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string' || !tokenString.startsWith('sk_sec_')) {
    return null;
  }
  try {
    const rawCipher = Buffer.from(tokenString.slice(7), 'base64url').toString('utf8');
    const decrypted = decrypt(rawCipher);
    if (!decrypted) return null;
    const payload = JSON.parse(decrypted);
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Token kedaluwarsa
    }
    return payload;
  } catch (err) {
    return null;
  }
}

module.exports = {
  encrypt,
  decrypt,
  generateSessionToken,
  verifySessionToken
};
