const app = require('./index');
const studentService = require('./src/modules/pkl-activity/services/student.service');
const taskService = require('./src/modules/pkl-activity/services/task.service');
const dailyEvalService = require('./src/modules/pkl-activity/services/daily-evaluation.service');
const weeklySumService = require('./src/modules/pkl-activity/services/weekly-summary.service');
const mentorSessionService = require('./src/modules/pkl-activity/services/mentor-session.service');

async function runServiceTests() {
  console.log('==================================================');
  console.log('Mulai Pengujian Unit Sederhana Service Layer...');
  console.log('==================================================');

  const db = app.pool;
  let testsFailed = 0;

  // Gunakan User ID Siswa Magang 1 yang terdaftar di seeder
  const studentUserId = 'usr-student';
  const testDate = '2026-06-26'; // Jumat, hari kerja valid

  console.log(`Menggunakan User ID Siswa: ${studentUserId}`);
  console.log(`Menggunakan Tanggal Pengujian: ${testDate}`);

  // Persiapan Database (Clean setup untuk pengetesan mandiri yang stabil)
  console.log('\n[SETUP] Membersihkan data lama untuk tanggal tes...');
  await db.query("DELETE FROM pkl_mentor_daily_sessions WHERE mentor_id = 'usr-mentor' AND session_date = ?", [testDate]);
  await db.query("DELETE FROM pkl_daily_evaluations WHERE evaluation_date = ?", [testDate]);

  // 1. Testing studentService
  try {
    console.log('\n[TEST 1] Menguji studentService...');
    
    // Test dashboard siswa
    const dashboard = await studentService.getStudentDashboard(db, studentUserId, testDate);
    console.log('✔ getStudentDashboard sukses:');
    console.log(`  - Pakaian Hari Ini: ${dashboard.today.clothes}`);
    console.log(`  - Status Absensi: ${dashboard.today.attendance_status} (${dashboard.today.attendance_time})`);
    console.log(`  - Progres PKL: Minggu ${dashboard.progress.active_week}/${dashboard.progress.total_weeks} (${dashboard.progress.percentage}%)`);
    console.log(`  - Milestone Tugas: ${dashboard.program_kerja.title} (${dashboard.program_kerja.tasks.length} tasks)`);
    console.log(`  - Papan Apresiasi Terbit: ${dashboard.papan_apresiasi.is_published}`);

    // Test dashboard mentor
    const mentorStudents = await studentService.getMentorStudents(db, 'usr-mentor', testDate);
    console.log(`✔ getMentorStudents sukses: Mentor membimbing ${mentorStudents.length} siswa`);
    if (mentorStudents.length > 0) {
      console.log(`  - Siswa Pertama: ${mentorStudents[0].student_name} (${mentorStudents[0].school_name}), evaluasi terisi: ${mentorStudents[0].evaluations !== null}`);
    }
  } catch (err) {
    console.error('❌ studentService mengalami eror:', err);
    testsFailed++;
  }

  // 2. Testing taskService
  try {
    console.log('\n[TEST 2] Menguji taskService...');
    // Coba toggle tugas
    const toggleSuccess = await taskService.toggleStudentTask(db, studentUserId, 'tsk-1-1', true);
    console.log(`✔ toggleStudentTask sukses: Status checklist tugas diubah (${toggleSuccess})`);
  } catch (err) {
    console.error('❌ taskService mengalami eror:', err);
    testsFailed++;
  }

  // 3. Testing dailyEvaluationService
  try {
    console.log('\n[TEST 3] Menguji dailyEvaluationService...');
    // Coba simpan evaluasi harian (idempotent)
    const success = await dailyEvalService.saveDailyEvaluation(db, 'usr-mentor', {
      student_id: 'std-siswa1',
      evaluation_date: testDate,
      wkt_point: 1,
      skp_point: 1,
      has_point: 1,
      ker_point: 0,
      ini_point: 1
    });
    console.log(`✔ saveDailyEvaluation sukses: Evaluasi berhasil disimpan (${success})`);

    // Validasi masa depan
    try {
      await dailyEvalService.saveDailyEvaluation(db, 'usr-mentor', {
        student_id: 'std-siswa1',
        evaluation_date: '2099-01-01',
        wkt_point: 1,
        skp_point: 1,
        has_point: 1,
        ker_point: 0,
        ini_point: 1
      });
      console.error('❌ saveDailyEvaluation gagal mendeteksi tanggal masa depan');
      testsFailed++;
    } catch (e) {
      console.log('✔ saveDailyEvaluation sukses mencegah tanggal di masa depan:', e.message);
    }
  } catch (err) {
    console.error('❌ dailyEvaluationService mengalami eror:', err);
    testsFailed++;
  }

  // 4. Testing weeklySummaryService
  try {
    console.log('\n[TEST 4] Menguji weeklySummaryService...');
    // Test ambil rekap mingguan
    const rekapList = await weeklySumService.getWeeklyRekapList(db, 'usr-mentor', 3);
    console.log(`✔ getWeeklyRekapList sukses: Ditemukan ${rekapList.length} draf rekap mingguan`);

    // Test simpan feedback mingguan
    const result = await weeklySumService.saveWeeklyFeedback(db, 'usr-mentor', 'std-siswa1', {
      week_number: 3,
      tags: ['⏱️ Disiplin', '💡 Kreatif'],
      comments: 'Mengerjakan tugas dengan baik'
    });
    console.log(`✔ saveWeeklyFeedback sukses: Draf berhasil disimpan. Warning: ${result.warning || 'none'}`);
  } catch (err) {
    console.error('❌ weeklySummaryService mengalami eror:', err);
    testsFailed++;
  }

  // 5. Testing mentorSessionService
  try {
    console.log('\n[TEST 5] Menguji mentorSessionService...');
    // Agar bisa submit lock session, input poin dulu untuk siswa kedua (Siswa Magang 2)
    await dailyEvalService.saveDailyEvaluation(db, 'usr-mentor', {
      student_id: 'std-siswa2',
      evaluation_date: testDate,
      wkt_point: 1,
      skp_point: 1,
      has_point: 0,
      ker_point: 1,
      ini_point: 0
    });

    // Cek status submit harian (sesi lock)
    const success = await mentorSessionService.submitDailySession(db, 'usr-mentor', testDate);
    console.log(`✔ submitDailySession sukses: Sesi berhasil dikunci (${success})`);

    // Cek apakah daily evaluation sekarang ditolak karena sesi sudah dikunci
    try {
      await dailyEvalService.saveDailyEvaluation(db, 'usr-mentor', {
        student_id: 'std-siswa1',
        evaluation_date: testDate,
        wkt_point: 1,
        skp_point: 1,
        has_point: 1,
        ker_point: 0,
        ini_point: 1
      });
      console.error('❌ dailyEvaluationService gagal mendeteksi sesi terkunci');
      testsFailed++;
    } catch (e) {
      console.log('✔ dailyEvaluationService sukses mencegah edit pada sesi terkunci:', e.message);
    }
  } catch (err) {
    console.error('❌ mentorSessionService mengalami eror:', err);
    testsFailed++;
  }

  // 6. Testing Batch Publication
  try {
    console.log('\n[TEST 6] Menguji publishWeeklySummary...');
    // Isi feedback untuk siswa kedua agar lolos validasi publikasi (karena semua siswa bimbingan wajib diisi tag)
    await weeklySumService.saveWeeklyFeedback(db, 'usr-mentor', 'std-siswa2', {
      week_number: 3,
      tags: ['🤝 Kerjasama'],
      comments: 'Mampu berkolaborasi dengan baik'
    });

    const publishSuccess = await weeklySumService.publishWeeklySummary(db, 'usr-mentor', 3);
    console.log(`✔ publishWeeklySummary sukses: Seluruh rekap mingguan dipublikasikan (${publishSuccess})`);
  } catch (err) {
    console.error('❌ publishWeeklySummary mengalami eror:', err);
    testsFailed++;
  }

  console.log('\n==================================================');
  if (testsFailed === 0) {
    console.log('🎉 SEMUA PENGUJIAN SERVICE LAYER LULUS DENGAN SUKSES!');
  } else {
    console.error(`❌ ${testsFailed} PENGUJIAN SERVICE LAYER GAGAL.`);
  }
  console.log('==================================================');

  // Bersihkan kembali data hasil testing agar tidak mencemari database seeder
  await db.query("DELETE FROM pkl_mentor_daily_sessions WHERE mentor_id = 'usr-mentor' AND session_date = ?", [testDate]);
  await db.query("DELETE FROM pkl_daily_evaluations WHERE evaluation_date = ?", [testDate]);

  process.exit(testsFailed === 0 ? 0 : 1);
}

// Tunggu hingga database ter-booting
setTimeout(() => {
  runServiceTests().catch(err => {
    console.error('Eror fatal selama pengujian:', err);
    process.exit(1);
  });
}, 2000);
