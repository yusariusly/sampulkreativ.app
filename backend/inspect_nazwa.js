const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Helper functions copied from index.js
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

function getWeekdaysCount(startDate, endDate) {
  let count = 0;
  let cur = new Date(startDate.getTime());
  while (cur.getTime() <= endDate.getTime()) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setTime(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return count;
}

async function main() {
  try {
    const studentRes = await pool.query(
      `SELECT ps.id as student_id, ps.user_id, ps.start_date, ps.end_date, u.nama_lengkap, u.created_at
       FROM pkl_students ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.nama_lengkap ILIKE '%Nazwa%'`
    );
    console.log('Student details:', studentRes.rows);

    if (studentRes.rows.length === 0) return;
    const { student_id, user_id, start_date, end_date, created_at } = studentRes.rows[0];

    // Simulate syncUserKieDebt logic
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const todayDate = parseJakartaDate(todayStr);

    const regDate = parseJakartaDate(created_at || new Date());
    const systemStartDate = parseJakartaDate('2026-07-02');
    const startDate = regDate.getTime() < systemStartDate.getTime() ? systemStartDate : regDate;
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);

    let completedWeekdays = 0;
    if (startDate.getTime() <= yesterdayDate.getTime()) {
      completedWeekdays = getWeekdaysCount(startDate, yesterdayDate);
    }
    const totalTarget = completedWeekdays * 4;

    const startDateStr = startDate.toISOString().split('T')[0];
    const subCountRes = await pool.query(
      `SELECT COALESCE(SUM(LEAST(4, daily_count)), 0) AS total_submissions FROM (
         SELECT COUNT(*) AS daily_count
         FROM kie_submissions
         WHERE user_id = $1
           AND (submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= $2
         GROUP BY (submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date
       ) sub`,
      [user_id, startDateStr]
    );
    const totalSubmissions = parseInt(subCountRes.rows[0]?.total_submissions || 0);
    const currentKieDebt = Math.max(0, totalTarget - totalSubmissions);

    console.log(`\nSimulation details for ${todayStr}:`);
    console.log(`- Start date for KIE tracking: ${startDateStr}`);
    console.log(`- Weekdays until yesterday: ${completedWeekdays}`);
    console.log(`- Target KIE: ${totalTarget}`);
    console.log(`- Capped submissions counted: ${totalSubmissions}`);
    console.log(`- New KIE Debt (Capped): ${currentKieDebt}`);

    // Update database directly
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    await pool.query(
      "UPDATE users SET kie_debt = $1, last_kie_debt_date = $2 WHERE id = $3",
      [currentKieDebt, yesterdayStr, user_id]
    );
    console.log('\nSuccessfully updated database with new capped KIE debt!');

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
