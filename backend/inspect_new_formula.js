const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

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

async function main() {
  try {
    const student_id = 'std-1782764534019'; // Nazwa
    const studentRes = await pool.query(
      `SELECT ps.id, ps.user_id, ps.start_date, ps.end_date
       FROM pkl_students ps
       WHERE ps.id = $1`,
      [student_id]
    );
    const student = studentRes.rows[0];
    const userId = student.user_id;

    // Get all KIE submissions for the user
    const subRes = await pool.query(
      `SELECT (submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date as date_str, COUNT(*) as count
       FROM kie_submissions
       WHERE user_id = $1
       GROUP BY (submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date
       ORDER BY date_str`,
      [userId]
    );
    const submissions = subRes.rows.map(r => ({
      dateStr: r.date_str.toISOString().split('T')[0],
      count: parseInt(r.count)
    }));

    console.log('Submissions:', submissions);

    const start = parseJakartaDate(student.start_date);
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const today = parseJakartaDate(todayStr);

    console.log('Start date:', start.toISOString().split('T')[0]);
    console.log('Today date:', todayStr);

    // Calculate day-by-day
    let C = 0;
    let cumulativeTarget = 0;
    let cur = new Date(start.getTime());

    const history = [];

    while (cur.getTime() <= today.getTime()) {
      const day = cur.getUTCDay();
      const isWeekday = (day !== 0 && day !== 6);
      const targetToday = isWeekday ? 4 : 0;
      cumulativeTarget += targetToday;

      const dateStr = cur.toISOString().split('T')[0];
      const subToday = submissions.find(s => s.dateStr === dateStr)?.count || 0;

      C = Math.min(C + subToday, cumulativeTarget);

      history.push({
        date: dateStr,
        dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
        sub: subToday,
        targetToday,
        cumTarget: cumulativeTarget,
        counted: C,
        pct: cumulativeTarget > 0 ? ((C / cumulativeTarget) * 100).toFixed(1) + '%' : '100%'
      });

      cur.setTime(cur.getTime() + 24 * 60 * 60 * 1000);
    }

    console.table(history);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
