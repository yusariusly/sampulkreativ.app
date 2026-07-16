const { Pool } = require('pg');
require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function formatDateStr(d) {
  if (!d) return null;
  if (d instanceof Date) {
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  }
  return String(d).split('T')[0];
}

async function calcKieForStudent(student_id, user_id, start_date, end_date) {
  const startStr = formatDateStr(start_date);
  const endStr = formatDateStr(end_date);

  const submissions = (await pool.query(
    `SELECT (k.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date as date_str, COUNT(*) as count
     FROM kie_submissions k
     WHERE k.user_id = $1
     GROUP BY (k.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date`,
    [user_id]
  )).rows;

  const subMap = {};
  submissions.forEach(s => {
    const dateStr = s.date_str instanceof Date ? s.date_str.toISOString().split('T')[0] : s.date_str;
    subMap[dateStr] = (subMap[dateStr] || 0) + parseInt(s.count);
  });

  const todayDate = new Date();
  const jakartaOffset = 7 * 60 * 60 * 1000;
  const todayStr = new Date(todayDate.getTime() + jakartaOffset).toISOString().split('T')[0];

  const dailyRecords = {};
  let C_run = 0;
  let cumulativeTarget = 0;
  let cur_day = new Date(startStr);
  const endLimitDate = new Date(endStr);

  const dayBefore = new Date(new Date(startStr).getTime() - 86400000);
  dailyRecords[formatDateStr(dayBefore)] = { counted: 0, cumulativeTarget: 0 };

  while (cur_day <= endLimitDate) {
    const day = cur_day.getUTCDay();
    const targetToday = (day !== 0 && day !== 6) ? 4 : 0;
    cumulativeTarget += targetToday;

    const dateStr = formatDateStr(cur_day);
    const subToday = subMap[dateStr] || 0;
    C_run = Math.min(C_run + subToday, cumulativeTarget);

    dailyRecords[dateStr] = { counted: C_run, cumulativeTarget };
    cur_day.setDate(cur_day.getDate() + 1);
  }

  const targetQueryDate = todayStr < endStr ? todayStr : endStr;
  const overallRecord = dailyRecords[targetQueryDate] || { counted: 0, cumulativeTarget: 0 };

  const totalKieSubmitted = overallRecord.counted;
  const totalKieTarget = overallRecord.cumulativeTarget;
  const rawSubmissions = submissions.reduce((sum, s) => sum + parseInt(s.count), 0);
  const kiePct = totalKieTarget > 0 ? Math.min(100, Math.round((totalKieSubmitted / totalKieTarget) * 10000) / 100) : 100;

  return { totalKieSubmitted, totalKieTarget, rawSubmissions, kiePct };
}

async function main() {
  try {
    const students = (await pool.query(
      `SELECT ps.id as student_id, ps.user_id, ps.start_date, ps.end_date, u.nama_lengkap, u.kie_debt
       FROM pkl_students ps
       JOIN users u ON u.id = ps.user_id
       ORDER BY u.nama_lengkap`
    )).rows;

    console.log(`\nTotal siswa: ${students.length}`);
    console.log('='.repeat(100));

    const results = [];
    for (const s of students) {
      const kie = await calcKieForStudent(s.student_id, s.user_id, s.start_date, s.end_date);
      results.push({
        nama: s.nama_lengkap,
        startDate: formatDateStr(s.start_date),
        endDate: formatDateStr(s.end_date),
        rawSetor: kie.rawSubmissions,
        terhitung: kie.totalKieSubmitted,
        target: kie.totalKieTarget,
        persen: kie.kiePct + '%',
        status: kie.kiePct >= 100 ? '✅ Lunas' : '❌ Ada Hutang',
        profileDebt: s.kie_debt
      });
    }

    console.table(results);

    // Summary
    const lunas = results.filter(r => r.status.includes('Lunas'));
    const hutang = results.filter(r => r.status.includes('Hutang'));
    console.log(`\n✅ Lunas: ${lunas.length} siswa`);
    console.log(`❌ Ada Hutang: ${hutang.length} siswa`);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
