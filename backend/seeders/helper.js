const crypto = require('crypto');

/**
 * Generate a random UUID-like string with prefix
 * @param {string} prefix 
 * @returns {string}
 */
function generateId(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Mendapatkan tanggal relatif terhadap hari ini format YYYY-MM-DD
 * @param {number} offsetDays 
 * @returns {string}
 */
function getRelativeDateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/**
 * Pengecekan apakah hari kerja (Senin - Jumat)
 * @param {string} dateStr 
 * @returns {boolean}
 */
function isWorkDay(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day !== 0 && day !== 6; // Bukan Minggu (0) dan Sabtu (6)
}

module.exports = {
  generateId,
  getRelativeDateStr,
  isWorkDay
};
