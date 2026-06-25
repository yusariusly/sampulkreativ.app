// 1. Status Konstanta
const REMOTE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
};

// Timezone helpers for Asia/Jakarta (UTC+7)
function getJakartaDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function getJakartaHour(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hour12: false
  }).formatToParts(date);
  const hourPart = parts.find(p => p.type === 'hour');
  if (!hourPart) return date.getUTCHours();
  const h = parseInt(hourPart.value, 10);
  return h === 24 ? 0 : h;
}

function getJakartaExpiredAt(now = new Date()) {
  const jakartaHour = getJakartaHour(now);
  let targetDate = new Date(now);
  if (jakartaHour >= 4) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  const targetDateStr = getJakartaDate(targetDate);
  return new Date(`${targetDateStr}T04:00:00+07:00`);
}

// 2. Data Transfer Object (DTO)
function wfhRequestDto(req) {
  if (!req) return null;
  return {
    id: req.id,
    tanggal: req.tanggal,
    alasan: req.alasan,
    status: req.status,
    created_at: req.created_at,
    report_submitted_at: req.report_submitted_at,
    report_content: req.report_content,
    report_attachment: req.report_attachment
  };
}

// 3. Facts Provider: Mengambil fakta database (Menggunakan Dependency Injection)
async function getTodayRemoteFacts(dbClient, userId) {
  const todayJakarta = getJakartaDate(new Date());

  const [wfhRows] = await dbClient.query(
    `SELECT id, tanggal, status, report_submitted_at, expired_at 
     FROM remote_requests 
     WHERE user_id = $1 AND tanggal = $2 
     ORDER BY created_at DESC LIMIT 1`,
    [userId, todayJakarta]
  );
  
  const [absensiRows] = await dbClient.query(
    `SELECT status FROM absensi 
     WHERE user_id = $1 
       AND waktu_absen >= $2::timestamptz 
       AND waktu_absen < ($2::timestamptz + INTERVAL '1 day')`,
    [userId, todayJakarta]
  );

  return {
    wfh: wfhRows[0] || null,
    absensi: absensiRows
  };
}

// 4. Sub-Evaluators: Logika bisnis kecil
function evaluateLeaveSickRemotePermission(status, hasHadir, hasIzin, hasSakit) {
  if (status === REMOTE_STATUS.PENDING) return { allowed: false, reason: 'WFH_REQUEST_PENDING' };
  if (status === REMOTE_STATUS.APPROVED) return { allowed: false, reason: 'WFH_REQUEST_APPROVED' };
  if (hasHadir) return { allowed: false, reason: 'ALREADY_CLOCKED_IN' };
  if (hasIzin) return { allowed: false, reason: 'ALREADY_ON_LEAVE' };
  if (hasSakit) return { allowed: false, reason: 'ALREADY_ON_SICK_LEAVE' };
  return { allowed: true, reason: null };
}

function evaluateClockInPermission(status, hasHadir, hasIzin, hasSakit) {
  if (hasHadir) return { allowed: false, reason: 'ALREADY_CLOCKED_IN' };
  if (hasIzin) return { allowed: false, reason: 'ON_LEAVE' };
  if (hasSakit) return { allowed: false, reason: 'ON_SICK_LEAVE' };
  if (status === REMOTE_STATUS.PENDING) return { allowed: false, reason: 'WFH_REQUEST_PENDING' };
  return { allowed: true, reason: null };
}

function evaluateClockOutPermission(status, hasHadir, hasPulang, reportSubmitted) {
  if (!hasHadir) return { allowed: false, reason: 'NOT_CLOCKED_IN' };
  if (hasPulang) return { allowed: false, reason: 'ALREADY_CLOCKED_OUT' };
  if (status === REMOTE_STATUS.APPROVED) return { allowed: false, reason: 'USE_DAILY_REPORT' };
  if (status === REMOTE_STATUS.PENDING) return { allowed: false, reason: 'WFH_REQUEST_PENDING' };
  return { allowed: true, reason: null };
}

function evaluateDailyReportPermission(status, hasHadir, reportSubmitted) {
  if (status !== REMOTE_STATUS.APPROVED) return { allowed: false, reason: 'WFH_NOT_APPROVED' };
  if (!hasHadir) return { allowed: false, reason: 'NOT_CLOCKED_IN' };
  if (reportSubmitted) return { allowed: false, reason: 'DAILY_REPORT_ALREADY_SUBMITTED' };
  return { allowed: true, reason: null };
}

// 5. Main Rules Evaluator
function evaluateRemotePermissions(facts) {
  const wfh = facts.wfh;
  const isExpired = wfh && wfh.expired_at && new Date() >= new Date(wfh.expired_at);
  const status = (wfh && !isExpired) ? wfh.status : null;
  const reportSubmitted = wfh ? wfh.report_submitted_at !== null : false;

  const hasHadir = facts.absensi.some(a => a.status === 'Hadir' || a.status === 'Terlambat');
  const hasPulang = facts.absensi.some(a => a.status === 'Pulang');
  const hasIzin = facts.absensi.some(a => a.status === 'Izin');
  const hasSakit = facts.absensi.some(a => a.status === 'Sakit');

  return {
    remoteStatus: status,
    reportSubmitted,
    permissions: {
      clockIn: evaluateClockInPermission(status, hasHadir, hasIzin, hasSakit),
      clockOut: evaluateClockOutPermission(status, hasHadir, hasPulang, reportSubmitted),
      leave: evaluateLeaveSickRemotePermission(status, hasHadir, hasIzin, hasSakit),
      sick: evaluateLeaveSickRemotePermission(status, hasHadir, hasIzin, hasSakit),
      remote: {
        allowed: (status === null || status === REMOTE_STATUS.CANCELLED || status === REMOTE_STATUS.REJECTED) && !hasHadir && !hasIzin && !hasSakit,
        reason: status === REMOTE_STATUS.PENDING ? 'WFH_REQUEST_PENDING' : 
                status === REMOTE_STATUS.APPROVED ? 'WFH_REQUEST_APPROVED' : 
                hasHadir ? 'ALREADY_CLOCKED_IN' : 
                hasIzin ? 'ALREADY_ON_LEAVE' : 
                hasSakit ? 'ALREADY_ON_SICK_LEAVE' : null
      },
      dailyReport: evaluateDailyReportPermission(status, hasHadir, reportSubmitted)
    },
    wfhRequest: wfhRequestDto(wfh)
  };
}

// 6. Orchestrator (Menggunakan Dependency Injection)
async function getTodayRemoteStatus(dbClient, userId) {
  const facts = await getTodayRemoteFacts(dbClient, userId);
  return evaluateRemotePermissions(facts);
}

module.exports = {
  REMOTE_STATUS,
  wfhRequestDto,
  getTodayRemoteFacts,
  evaluateRemotePermissions,
  getTodayRemoteStatus,
  getJakartaDate,
  getJakartaHour,
  getJakartaExpiredAt
};
