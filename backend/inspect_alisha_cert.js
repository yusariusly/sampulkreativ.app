const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Helper functions from index.js
function parseJakartaDate(dateVal) {
  if (!dateVal) return new Date();
  const dObj = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dObj);
  const [y, m, d] = formatted.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

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

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function subtractOneDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function addOneDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

async function main() {
  const student_id = 'std-1782764724011'; // Alisha
  const curriculum_id = '1';

  try {
    const studentRows = (await pool.query(
      `SELECT ps.id, ps.user_id, ps.start_date, ps.end_date, ps.kie_progress_override,
              u.nama_lengkap, u.role
       FROM pkl_students ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.id = $1`,
      [student_id]
    )).rows;
    if (studentRows.length === 0) {
      console.log('Student not found');
      return;
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

    console.log('PKL start date:', startStr);
    console.log('PKL end date:', endStr);

    const criteriaRows = (await pool.query(
      'SELECT id, name, sort_order FROM cert_grade_criteria WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    )).rows;

    const scoreRows = (await pool.query(
      'SELECT month_number, criterion_id, score FROM cert_criterion_scores WHERE student_id = $1 AND curriculum_id = $2',
      [student_id, curriculum_id]
    )).rows;

    const scoreMap = {};
    scoreRows.forEach(s => {
      if (!scoreMap[s.month_number]) scoreMap[s.month_number] = {};
      scoreMap[s.month_number][s.criterion_id] = parseFloat(s.score);
    });

    const gradeRows = (await pool.query(
      'SELECT month_number, notes FROM cert_monthly_grades WHERE student_id = $1 AND curriculum_id = $2',
      [student_id, curriculum_id]
    )).rows;
    const notesMap = {};
    gradeRows.forEach(g => { notesMap[g.month_number] = g.notes; });

    // Fetch all KIE submissions for this student to pre-calculate day-by-day capped progression
    const submissions = (await pool.query(
      `SELECT (k.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date as date_str, COUNT(*) as count
       FROM kie_submissions k
       JOIN users u ON u.id = k.user_id
       JOIN pkl_students ps ON ps.user_id = u.id
       WHERE ps.id = $1
       GROUP BY (k.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date`,
      [student_id]
    )).rows;

    const subMap = {};
    submissions.forEach(s => {
      const dateStr = s.date_str instanceof Date ? s.date_str.toISOString().split('T')[0] : s.date_str;
      subMap[dateStr] = (subMap[dateStr] || 0) + parseInt(s.count);
    });

    const todayDate = new Date();
    const jakartaOffset = 7 * 60 * 60 * 1000;
    const todayJakarta = new Date(todayDate.getTime() + jakartaOffset);
    const todayStr = todayJakarta.toISOString().split('T')[0];

    const dailyRecords = {};
    let C_run = 0;
    let cumulativeTarget = 0;
    let cur_day = new Date(startStr);
    const endLimitDate = new Date(endStr);

    const dayBeforeStart = new Date(new Date(startStr).getTime() - 24 * 60 * 60 * 1000);
    dailyRecords[formatDateStr(dayBeforeStart)] = { counted: 0, cumulativeTarget: 0 };

    while (cur_day <= endLimitDate) {
      const day = cur_day.getUTCDay();
      const isWeekday = (day !== 0 && day !== 6);
      const targetToday = isWeekday ? 4 : 0;
      cumulativeTarget += targetToday;

      const dateStr = formatDateStr(cur_day);
      const subToday = subMap[dateStr] || 0;

      C_run = Math.min(C_run + subToday, cumulativeTarget);

      dailyRecords[dateStr] = {
        counted: C_run,
        cumulativeTarget: cumulativeTarget
      };

      cur_day.setDate(cur_day.getDate() + 1);
    }

    const months = [];
    let curStart = startStr;
    let m = 1;

    while (curStart <= endStr) {
      const nextMonthStr = addMonths(startStr, m);
      const curEnd = subtractOneDay(nextMonthStr);
      const actualEnd = curEnd < endStr ? curEnd : endStr;

      let targetEnd = actualEnd;
      if (curStart > todayStr) {
        targetEnd = null;
      } else if (actualEnd >= todayStr) {
        targetEnd = todayStr;
      }

      const dayBeforeStartStr = subtractOneDay(curStart);
      const startRecord = dailyRecords[dayBeforeStartStr] || { counted: 0, cumulativeTarget: 0 };
      const endRecord = targetEnd ? (dailyRecords[targetEnd] || { counted: 0, cumulativeTarget: 0 }) : null;

      const kieTarget = endRecord ? (endRecord.cumulativeTarget - startRecord.cumulativeTarget) : 0;
      const kieSubmitted = endRecord ? (endRecord.counted - startRecord.counted) : 0;
      const kiePct = kieTarget > 0 ? Math.min(100, (kieSubmitted / kieTarget) * 100) : 100;

      const workingDays = countWorkingDays(new Date(curStart), new Date(actualEnd));

      const monthScores = scoreMap[m] || {};
      const filledScores = criteriaRows.map(c => monthScores[c.id] ?? null).filter(v => v !== null);
      const activityAvg = filledScores.length > 0
        ? filledScores.reduce((s, v) => s + v, 0) / filledScores.length
        : null;

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

    console.log('Calculation successful!');
    console.log('Months details:', months);

  } catch (err) {
    console.error('Error during calculation:', err);
  } finally {
    await pool.end();
  }
}

main();
