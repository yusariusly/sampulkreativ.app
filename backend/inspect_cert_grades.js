const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Helpers
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
  try {
    const student_id = 'std-1782764534019'; // Nazwa
    const studentRes = await pool.query(
      `SELECT ps.id, ps.user_id, ps.start_date, ps.end_date, ps.kie_progress_override
       FROM pkl_students ps
       WHERE ps.id = $1`,
      [student_id]
    );
    const student = studentRes.rows[0];
    console.log('Student PKL:', student);

    const startStr = student.start_date.toISOString().split('T')[0];
    const endStr = student.end_date.toISOString().split('T')[0];

    const months = [];
    let curStart = startStr;
    let m = 1;

    while (curStart <= endStr) {
      const nextMonthStr = addMonths(startStr, m);
      const curEnd = subtractOneDay(nextMonthStr);
      const actualEnd = curEnd < endStr ? curEnd : endStr;

      // KIE for this month range
      const [kieCountRows] = (await pool.query(
        `SELECT COUNT(*) as total FROM kie_submissions k
         JOIN users u ON u.id = k.user_id
         JOIN pkl_students ps ON ps.user_id = u.id
         WHERE ps.id = $1
           AND (k.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= $2
           AND (k.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= $3`,
        [student_id, curStart, actualEnd]
      )).rows;

      const kieSubmitted = parseInt(kieCountRows?.total || 0);

      const todayDate = new Date();
      const jakartaOffset = 7 * 60 * 60 * 1000;
      const todayJakarta = new Date(todayDate.getTime() + jakartaOffset);
      const todayStr = todayJakarta.toISOString().split('T')[0];

      let targetEnd = actualEnd;
      if (curStart > todayStr) {
        targetEnd = null;
      } else if (actualEnd >= todayStr) {
        targetEnd = todayStr;
      }

      const workingDays = countWorkingDays(new Date(curStart), new Date(actualEnd));
      const targetWorkingDays = targetEnd ? countWorkingDays(new Date(curStart), new Date(targetEnd)) : 0;
      const kieTarget = targetWorkingDays * 4;
      const kiePct = kieTarget > 0 ? Math.min(100, (kieSubmitted / kieTarget) * 100) : 100;

      months.push({
        month_number: m,
        month_start: curStart,
        month_end: actualEnd,
        kie_submitted: kieSubmitted,
        kie_target: kieTarget,
        kie_pct: kiePct,
        target_end: targetEnd
      });

      curStart = addOneDay(actualEnd);
      m++;
      if (curStart > endStr || m > 24) break;
    }

    console.log('\nMonths detail:');
    console.table(months);

    const totalKieSubmitted = months.reduce((sum, mo) => sum + mo.kie_submitted, 0);
    const totalKieTarget = months.reduce((sum, mo) => sum + mo.kie_target, 0);
    const autoKiePct = totalKieTarget > 0 ? Math.min(100, (totalKieSubmitted / totalKieTarget) * 100) : 100;
    const kieOverallPct = student.kie_progress_override !== null ? parseFloat(student.kie_progress_override) : autoKiePct;

    console.log(`\nOverall results:`);
    console.log(`- totalKieSubmitted: ${totalKieSubmitted}`);
    console.log(`- totalKieTarget: ${totalKieTarget}`);
    console.log(`- autoKiePct: ${autoKiePct}`);
    console.log(`- kieOverallPct: ${kieOverallPct}`);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
