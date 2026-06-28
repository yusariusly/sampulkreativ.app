const { getRelativeDateStr, isWorkDay } = require('./helper');

async function seedPkl(dbClient) {
  console.log('[Seeder] Menjalankan seeder PKL...');
  let createdCount = 0;

  // 1. Seed PKL Templates
  const templates = [
    { id: 'tmpl-web-dev', title: 'Pengembangan Web Front-End & Back-End', duration_months: 4 }
  ];

  for (const tmpl of templates) {
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM pkl_program_templates WHERE id = ?', [tmpl.id]);
    if (rows[0].cnt === 0) {
      await dbClient.query(
        'INSERT INTO pkl_program_templates (id, title, duration_months) VALUES (?, ?, ?)',
        [tmpl.id, tmpl.title, tmpl.duration_months]
      );
      createdCount++;
    }
  }

  // 2. Seed PKL Weeks
  const weeks = [
    { id: 'wk-1', template_id: 'tmpl-web-dev', week_number: 1, month_number: 1, milestone_title: 'Adaptasi Lingkungan Kerja & Dasar HTML/CSS' },
    { id: 'wk-2', template_id: 'tmpl-web-dev', week_number: 2, month_number: 1, milestone_title: 'Logika Dasar Javascript & Node.js' },
    { id: 'wk-3', template_id: 'tmpl-web-dev', week_number: 3, month_number: 1, milestone_title: 'Instalasi Database PostgreSQL & Integrasi Express' },
    { id: 'wk-4', template_id: 'tmpl-web-dev', week_number: 4, month_number: 1, milestone_title: 'Membangun RESTful API Pertama' }
  ];

  for (const wk of weeks) {
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM pkl_program_weeks WHERE id = ?', [wk.id]);
    if (rows[0].cnt === 0) {
      await dbClient.query(
        'INSERT INTO pkl_program_weeks (id, template_id, week_number, month_number, milestone_title) VALUES (?, ?, ?, ?, ?)',
        [wk.id, wk.template_id, wk.week_number, wk.month_number, wk.milestone_title]
      );
      createdCount++;
    }
  }

  // 3. Seed PKL Tasks
  const tasks = [
    // Week 1 Tasks
    { id: 'tsk-1-1', week_id: 'wk-1', task_title: 'Membaca pedoman PKL dan mematuhi tata tertib', is_mandatory: 1 },
    { id: 'tsk-1-2', week_id: 'wk-1', task_title: 'Mengatur environment workspace lokal (VSCode, Git)', is_mandatory: 1 },
    { id: 'tsk-1-3', week_id: 'wk-1', task_title: 'Membuat mockup halaman landing page sederhana', is_mandatory: 0 },
    // Week 2 Tasks
    { id: 'tsk-2-1', week_id: 'wk-2', task_title: 'Mengimplementasikan fungsi array map & filter', is_mandatory: 1 },
    { id: 'tsk-2-2', week_id: 'wk-2', task_title: 'Membuat server HTTP sederhana dengan Node.js', is_mandatory: 1 },
    { id: 'tsk-2-3', week_id: 'wk-2', task_title: 'Mengikuti sesi evaluasi kode mingguan', is_mandatory: 0 },
    // Week 3 Tasks
    { id: 'tsk-3-1', week_id: 'wk-3', task_title: 'Membuat koneksi Express.js ke PostgreSQL pool', is_mandatory: 1 },
    { id: 'tsk-3-2', week_id: 'wk-3', task_title: 'Menulis berkas migrasi tabel awal', is_mandatory: 1 },
    // Week 4 Tasks
    { id: 'tsk-4-1', week_id: 'wk-4', task_title: 'Menyelesaikan endpoint POST, GET, PUT untuk CRUD data', is_mandatory: 1 },
    { id: 'tsk-4-2', week_id: 'wk-4', task_title: 'Melakukan deployment hosting lokal', is_mandatory: 1 }
  ];

  for (const tsk of tasks) {
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM pkl_program_tasks WHERE id = ?', [tsk.id]);
    if (rows[0].cnt === 0) {
      await dbClient.query(
        'INSERT INTO pkl_program_tasks (id, week_id, task_title, is_mandatory) VALUES (?, ?, ?, ?)',
        [tsk.id, tsk.week_id, tsk.task_title, tsk.is_mandatory]
      );
      createdCount++;
    }
  }

  // 4. Seed PKL Students
  // Kita menautkan ke user_id 'usr-student' (Siswa 1) dan 'usr-student2' (Siswa 2) yang diseed sebelumnya.
  const students = [
    {
      id: 'std-siswa1',
      user_id: 'usr-student',
      mentor_id: 'usr-mentor',
      program_template_id: 'tmpl-web-dev',
      school_name: 'SMKN 1 Jakarta',
      start_date: getRelativeDateStr(-30), // Dimulai 30 hari yang lalu
      end_date: getRelativeDateStr(90)     // Berakhir 90 hari ke depan
    },
    {
      id: 'std-siswa2',
      user_id: 'usr-student2',
      mentor_id: 'usr-mentor',
      program_template_id: 'tmpl-web-dev',
      school_name: 'SMKN 2 Bandung',
      start_date: getRelativeDateStr(-15), // Dimulai 15 hari yang lalu
      end_date: getRelativeDateStr(105)    // Berakhir 105 hari ke depan
    }
  ];

  for (const std of students) {
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM pkl_students WHERE id = ?', [std.id]);
    if (rows[0].cnt === 0) {
      await dbClient.query(
        'INSERT INTO pkl_students (id, user_id, mentor_id, program_template_id, school_name, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [std.id, std.user_id, std.mentor_id, std.program_template_id, std.school_name, std.start_date, std.end_date]
      );
      createdCount++;
    }
  }

  // 5. Seed Student Tasks Completion (Checkbox Tugas Mandiri)
  const studentTasks = [
    // Siswa 1 (Menyelesaikan Week 1 & Week 2 sepenuhnya)
    { id: 'st-1-1', student_id: 'std-siswa1', task_id: 'tsk-1-1', is_completed: 1 },
    { id: 'st-1-2', student_id: 'std-siswa1', task_id: 'tsk-1-2', is_completed: 1 },
    { id: 'st-1-3', student_id: 'std-siswa1', task_id: 'tsk-1-3', is_completed: 1 },
    { id: 'st-2-1', student_id: 'std-siswa1', task_id: 'tsk-2-1', is_completed: 1 },
    { id: 'st-2-2', student_id: 'std-siswa1', task_id: 'tsk-2-2', is_completed: 1 },
    { id: 'st-2-3', student_id: 'std-siswa1', task_id: 'tsk-2-3', is_completed: 0 },
    // Siswa 1 (Week 3 belum selesai)
    { id: 'st-3-1', student_id: 'std-siswa1', task_id: 'tsk-3-1', is_completed: 0 },
    { id: 'st-3-2', student_id: 'std-siswa1', task_id: 'tsk-3-2', is_completed: 0 },

    // Siswa 2 (Hanya menyelesaikan beberapa tugas Week 1)
    { id: 'st2-1-1', student_id: 'std-siswa2', task_id: 'tsk-1-1', is_completed: 1 },
    { id: 'st2-1-2', student_id: 'std-siswa2', task_id: 'tsk-1-2', is_completed: 0 },
    { id: 'st2-1-3', student_id: 'std-siswa2', task_id: 'tsk-1-3', is_completed: 0 }
  ];

  for (const st of studentTasks) {
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM pkl_student_tasks WHERE id = ?', [st.id]);
    if (rows[0].cnt === 0) {
      await dbClient.query(
        'INSERT INTO pkl_student_tasks (id, student_id, task_id, is_completed) VALUES (?, ?, ?, ?)',
        [st.id, st.student_id, st.task_id, st.is_completed]
      );
      createdCount++;
    }
  }

  // 6. Seed Daily Evaluations (Evaluasi Nilai Harian Poin 0 atau 1)
  // Kita isi data untuk Siswa 1 selama 15 hari kerja terakhir ke belakang
  let evalDaysCreated = 0;
  for (let i = -20; i < 0; i++) {
    const dateStr = getRelativeDateStr(i);
    if (!isWorkDay(dateStr)) continue; // Hanya hari kerja

    const evalId = `ev-std1-${dateStr}`;
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM pkl_daily_evaluations WHERE id = ?', [evalId]);
    if (rows[0].cnt === 0) {
      // Kita beri nilai variatif (sebagian besar 1, sesekali 0 untuk realistis)
      const wkt = Math.random() > 0.1 ? 1 : 0;
      const skp = Math.random() > 0.05 ? 1 : 0;
      const has = Math.random() > 0.15 ? 1 : 0;
      const ker = Math.random() > 0.1 ? 1 : 0;
      const ini = Math.random() > 0.25 ? 1 : 0;

      await dbClient.query(
        `INSERT INTO pkl_daily_evaluations (id, student_id, evaluation_date, wkt_point, skp_point, has_point, ker_point, ini_point) 
         VALUES (?, 'std-siswa1', ?, ?, ?, ?, ?, ?)`,
        [evalId, dateStr, wkt, skp, has, ker, ini]
      );
      evalDaysCreated++;
      createdCount++;
    }
  }

  // Seed Mentor Daily Sessions untuk menandai status submits (lock harian)
  for (let i = -20; i < 0; i++) {
    const dateStr = getRelativeDateStr(i);
    if (!isWorkDay(dateStr)) continue;

    const sessId = `ms-mentor-${dateStr}`;
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM pkl_mentor_daily_sessions WHERE id = ?', [sessId]);
    if (rows[0].cnt === 0) {
      await dbClient.query(
        'INSERT INTO pkl_mentor_daily_sessions (id, mentor_id, session_date, is_submitted) VALUES (?, \'usr-mentor\', ?, 1)',
        [sessId, dateStr]
      );
      createdCount++;
    }
  }

  // 7. Seed Weekly Summaries (Rekap Nilai Mingguan)
  const summaries = [
    {
      id: 'sum-std1-w1',
      student_id: 'std-siswa1',
      week_number: 1,
      total_points: 24, // Dari max 25 poin (5 hari x 5 aspek)
      comments: 'Progress adaptasi awal sangat cepat, memahami petunjuk dengan baik dan disiplin dalam pengerjaan milestone.',
      tags: JSON.stringify(['Disiplin', 'Cepat Paham']),
      is_published: 1
    },
    {
      id: 'sum-std1-w2',
      student_id: 'std-siswa1',
      week_number: 2,
      total_points: 22,
      comments: 'Hasil implementasi logic Javascript rapi, namun koordinasi dengan tim perlu ditingkatkan sedikit.',
      tags: JSON.stringify(['Logika Kuat', 'Rapi']),
      is_published: 1
    },
    {
      id: 'sum-std1-w3',
      student_id: 'std-siswa1',
      week_number: 3,
      total_points: 23,
      comments: 'Dapat menyelesaikan koneksi db Express dengan lancar. Inisiatif mencari solusi error mandiri sangat bagus.',
      tags: JSON.stringify(['Mandiri', 'Proaktif']),
      is_published: 0 // Belum di-publish ke siswa
    }
  ];

  for (const sum of summaries) {
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM pkl_weekly_summaries WHERE id = ?', [sum.id]);
    if (rows[0].cnt === 0) {
      await dbClient.query(
        `INSERT INTO pkl_weekly_summaries (id, student_id, week_number, total_points, comments, tags, is_published) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sum.id, sum.student_id, sum.week_number, sum.total_points, sum.comments, sum.tags, sum.is_published]
      );
      createdCount++;
    }
  }

  console.log(`[Seeder] Seeder PKL selesai. Record dibuat: ${createdCount} (Evaluasi Harian: ${evalDaysCreated} hari)`);
}

module.exports = { seedPkl };
