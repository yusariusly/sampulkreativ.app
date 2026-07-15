const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.eyzttndowhpsbfdmchdp:q7%2Ca3S2GrwmwvuQ@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });

async function run() {
  try {
    const students = (await pool.query(`
      SELECT s.id as student_id, u.nama_lengkap, s.start_date, s.end_date
      FROM pkl_students s
      JOIN users u ON s.user_id = u.id
      WHERE s.program_template_id = 'tmpl-8rr6u0xo7' AND s.status = 'ACTIVE'
    `)).rows;

    console.log(`Found ${students.length} active students.`);

    const formatDateStr = (d) => {
      if (!d) return null;
      if (d instanceof Date) {
        const offset = d.getTimezoneOffset() * 60000;
        const local = new Date(d.getTime() - offset);
        return local.toISOString().split('T')[0];
      }
      return String(d).split('T')[0];
    };

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

    for (const student of students) {
      console.log(`\nTesting student: ${student.nama_lengkap} (ID: ${student.student_id})`);
      const startStr = formatDateStr(student.start_date);
      const endStr = formatDateStr(student.end_date);
      console.log(`  startStr: ${startStr}, endStr: ${endStr}`);

      if (!startStr || !endStr) {
        console.log("  Missing start_date or end_date. Skipping.");
        continue;
      }

      let curStart = startStr;
      let m = 1;
      let iterations = 0;

      while (curStart <= endStr) {
        iterations++;
        const nextMonthStr = addMonths(startStr, m);
        const curEnd = subtractOneDay(nextMonthStr);
        const actualEnd = curEnd < endStr ? curEnd : endStr;

        curStart = addOneDay(actualEnd);
        m++;

        if (curStart > endStr || m > 24) {
          break;
        }

        if (iterations > 100) {
          console.error(`  [HANG DETECTED] Student ${student.nama_lengkap} caused infinite loop!`);
          process.exit(1);
        }
      }
      console.log(`  Completed successfully in ${iterations} iterations.`);
    }

    console.log("\nAll students tested. No hangs found!");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
