const http = require('http');
const app = require('./index');

function makeRequest(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 5005,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (e) => { reject(e); });
    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

async function runControllerTests() {
  console.log('==================================================');
  console.log('Mulai Pengujian Integrasi Controller Layer...');
  console.log('==================================================');

  const db = app.pool;
  let testsFailed = 0;
  const testDate = '2026-06-26'; // Jumat, hari kerja valid
  const testDevice = 'test-device-student';

  // 1. SETUP DATABASE
  console.log('[SETUP] Mempersiapkan data uji di database...');
  await db.query("UPDATE users SET device_id = ?, is_active = 1 WHERE id = 'usr-student'", [testDevice]);
  await db.query("UPDATE users SET is_active = 1 WHERE id = 'usr-mentor'");
  
  // Bersihkan data lama untuk tanggal pengetesan
  await db.query("DELETE FROM pkl_mentor_daily_sessions WHERE mentor_id = 'usr-mentor' AND session_date = ?", [testDate]);
  await db.query("DELETE FROM pkl_daily_evaluations WHERE evaluation_date = ?", [testDate]);

  // Headers untuk Siswa & Mentor
  const studentHeaders = {
    'x-user-id': 'usr-student',
    'x-device-id': testDevice
  };
  const mentorHeaders = {
    'x-user-id': 'usr-mentor'
  };

  // ==========================================
  // PENGETESAN ROUTE SISWA
  // ==========================================

  // TEST 1: GET /api/v1/siswa/aktivitas
  try {
    console.log('\n[TEST 1] GET /api/v1/siswa/aktivitas');
    const res = await makeRequest('GET', `/api/v1/siswa/aktivitas?date=${testDate}`, studentHeaders);
    if (res.status === 200 && res.body.status === 'success') {
      console.log('✔ GET /api/v1/siswa/aktivitas Lulus');
      console.log(`  - Baju Hari Ini: ${res.body.data.today.clothes}`);
      console.log(`  - Absensi: ${res.body.data.today.attendance_status}`);
      console.log(`  - Papan Apresiasi Terbit: ${res.body.data.papan_apresiasi.is_published}`);
    } else {
      console.error('❌ GET /api/v1/siswa/aktivitas Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ GET /api/v1/siswa/aktivitas Eror:', err);
    testsFailed++;
  }

  // TEST 2: GET /api/v1/siswa/riwayat
  try {
    console.log('\n[TEST 2] GET /api/v1/siswa/riwayat');
    const res = await makeRequest('GET', '/api/v1/siswa/riwayat', studentHeaders);
    if (res.status === 200 && res.body.status === 'success') {
      console.log('✔ GET /api/v1/siswa/riwayat Lulus');
      console.log(`  - Jumlah Riwayat: ${res.body.data.length}`);
    } else {
      console.error('❌ GET /api/v1/siswa/riwayat Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ GET /api/v1/siswa/riwayat Eror:', err);
    testsFailed++;
  }

  // TEST 3: PATCH /api/v1/siswa/tugas/:taskId
  try {
    console.log('\n[TEST 3] PATCH /api/v1/siswa/tugas/:taskId');
    const res = await makeRequest('PATCH', '/api/v1/siswa/tugas/tsk-1-1', studentHeaders, {
      is_completed: true
    });
    if (res.status === 200 && res.body.status === 'success') {
      console.log('✔ PATCH /api/v1/siswa/tugas/:taskId Lulus');
    } else {
      console.error('❌ PATCH /api/v1/siswa/tugas/:taskId Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ PATCH /api/v1/siswa/tugas/:taskId Eror:', err);
    testsFailed++;
  }

  // ==========================================
  // PENGETESAN ROUTE MENTOR
  // ==========================================

  // TEST 4: GET /api/v1/mentor/siswa
  try {
    console.log('\n[TEST 4] GET /api/v1/mentor/siswa');
    const res = await makeRequest('GET', `/api/v1/mentor/siswa?date=${testDate}`, mentorHeaders);
    if (res.status === 200 && res.body.status === 'success') {
      console.log('✔ GET /api/v1/mentor/siswa Lulus');
      console.log(`  - Siswa terbimbing: ${res.body.data.length}`);
    } else {
      console.error('❌ GET /api/v1/mentor/siswa Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ GET /api/v1/mentor/siswa Eror:', err);
    testsFailed++;
  }

  // TEST 5: PUT /api/v1/mentor/evaluasi-harian
  try {
    console.log('\n[TEST 5] PUT /api/v1/mentor/evaluasi-harian');
    const res = await makeRequest('PUT', '/api/v1/mentor/evaluasi-harian', mentorHeaders, {
      evaluation_date: testDate,
      student_id: 'std-siswa1',
      wkt_point: 1,
      skp_point: 1,
      has_point: 1,
      ker_point: 0,
      ini_point: 1
    });
    if (res.status === 200 && res.body.status === 'success') {
      console.log('✔ PUT /api/v1/mentor/evaluasi-harian Lulus');
    } else {
      console.error('❌ PUT /api/v1/mentor/evaluasi-harian Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ PUT /api/v1/mentor/evaluasi-harian Eror:', err);
    testsFailed++;
  }

  // TEST 6: GET /api/v1/mentor/rekap-mingguan
  try {
    console.log('\n[TEST 6] GET /api/v1/mentor/rekap-mingguan');
    const res = await makeRequest('GET', '/api/v1/mentor/rekap-mingguan?week_number=3', mentorHeaders);
    if (res.status === 200 && res.body.status === 'success') {
      console.log('✔ GET /api/v1/mentor/rekap-mingguan Lulus');
      console.log(`  - Rekap Minggu 3: ${res.body.data.length} siswa`);
    } else {
      console.error('❌ GET /api/v1/mentor/rekap-mingguan Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ GET /api/v1/mentor/rekap-mingguan Eror:', err);
    testsFailed++;
  }

  // TEST 7: PUT /api/v1/mentor/rekap-mingguan/:studentId
  try {
    console.log('\n[TEST 7] PUT /api/v1/mentor/rekap-mingguan/:studentId');
    const res = await makeRequest('PUT', '/api/v1/mentor/rekap-mingguan/std-siswa1', mentorHeaders, {
      week_number: 3,
      tags: ['⏱️ Disiplin', '💡 Kreatif'],
      comments: 'Mengerjakan tugas dengan baik'
    });
    if (res.status === 200 && res.body.status === 'success') {
      console.log('✔ PUT /api/v1/mentor/rekap-mingguan/:studentId Lulus');
    } else {
      console.error('❌ PUT /api/v1/mentor/rekap-mingguan/:studentId Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ PUT /api/v1/mentor/rekap-mingguan/:studentId Eror:', err);
    testsFailed++;
  }

  // TEST 8: POST /api/v1/mentor/evaluasi-harian/kirim (Sesi lock harian)
  try {
    console.log('\n[TEST 8] POST /api/v1/mentor/evaluasi-harian/kirim');
    
    // Isi dulu poin harian siswa kedua agar lolos validasi lock
    await makeRequest('PUT', '/api/v1/mentor/evaluasi-harian', mentorHeaders, {
      evaluation_date: testDate,
      student_id: 'std-siswa2',
      wkt_point: 1,
      skp_point: 0,
      has_point: 1,
      ker_point: 1,
      ini_point: 0
    });

    const res = await makeRequest('POST', '/api/v1/mentor/evaluasi-harian/kirim', mentorHeaders, {
      session_date: testDate
    });
    if (res.status === 200 && res.body.status === 'success') {
      console.log('✔ POST /api/v1/mentor/evaluasi-harian/kirim Lulus');
    } else {
      console.error('❌ POST /api/v1/mentor/evaluasi-harian/kirim Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ POST /api/v1/mentor/evaluasi-harian/kirim Eror:', err);
    testsFailed++;
  }

  // ==========================================
  // PENGETESAN EROR & VALIDASI GLOBAL
  // ==========================================

  // TEST 9: Edit data harian yang sudah dikunci (DAILY_SESSION_LOCKED)
  try {
    console.log('\n[TEST 9] Tes Eror: Edit pada sesi terkunci');
    const res = await makeRequest('PUT', '/api/v1/mentor/evaluasi-harian', mentorHeaders, {
      evaluation_date: testDate,
      student_id: 'std-siswa1',
      wkt_point: 1,
      skp_point: 1,
      has_point: 1,
      ker_point: 1,
      ini_point: 1
    });

    if (res.status === 400 && res.body.status === 'error' && res.body.error.code === 'DAILY_SESSION_LOCKED') {
      console.log('✔ Tes Eror: Edit pada sesi terkunci Lulus');
      console.log(`  - Error Message: ${res.body.error.message}`);
    } else {
      console.error('❌ Tes Eror: Edit pada sesi terkunci Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ Tes Eror: Edit pada sesi terkunci Eror:', err);
    testsFailed++;
  }

  // TEST 10: Input data invalid (INVALID_INPUT)
  try {
    console.log('\n[TEST 10] Tes Eror: Input data tidak valid');
    const res = await makeRequest('PUT', '/api/v1/mentor/evaluasi-harian', mentorHeaders, {
      evaluation_date: 'invalid-date',
      student_id: 'std-siswa1',
      wkt_point: 99, // Harus 0 atau 1
      skp_point: 1,
      has_point: 1,
      ker_point: 1,
      ini_point: 1
    });

    if (res.status === 400 && res.body.status === 'error' && res.body.error.code === 'INVALID_INPUT') {
      console.log('✔ Tes Eror: Input data tidak valid Lulus');
      console.log(`  - Jumlah detail eror: ${res.body.error.details.length}`);
      res.body.error.details.forEach(d => console.log(`    * Field [${d.field}]: ${d.message}`));
    } else {
      console.error('❌ Tes Eror: Input data tidak valid Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ Tes Eror: Input data tidak valid Eror:', err);
    testsFailed++;
  }

  // TEST 11: Otorisasi Kepemilikan (FORBIDDEN)
  try {
    console.log('\n[TEST 11] Tes Eror: Otorisasi Kepemilikan (FORBIDDEN)');
    
    // Ubah sementara mentor_id std-siswa2 ke user 'usr-admin' yang valid di tabel users
    await db.query("UPDATE pkl_students SET mentor_id = 'usr-admin' WHERE id = 'std-siswa2'");

    // Mentor usr-mentor mencoba mengisi feedback std-siswa2 yang sekarang milik usr-admin
    const res = await makeRequest('PUT', '/api/v1/mentor/rekap-mingguan/std-siswa2', mentorHeaders, {
      week_number: 3,
      tags: ['⏱️ Disiplin'],
      comments: 'Coba bypass'
    });

    // Kembalikan mentor_id ke semula
    await db.query("UPDATE pkl_students SET mentor_id = 'usr-mentor' WHERE id = 'std-siswa2'");

    if (res.status === 403 && res.body.status === 'error' && res.body.error.code === 'FORBIDDEN') {
      console.log('✔ Tes Eror: Otorisasi Kepemilikan Lulus');
      console.log(`  - Error Message: ${res.body.error.message}`);
    } else {
      console.error('❌ Tes Eror: Otorisasi Kepemilikan Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ Tes Eror: Otorisasi Kepemilikan Eror:', err);
    testsFailed++;
  }

  // ==========================================
  // FINALISASI PENGETESAN
  // ==========================================

  // TEST 12: POST /api/v1/mentor/rekap-mingguan/publikasikan
  try {
    console.log('\n[TEST 12] POST /api/v1/mentor/rekap-mingguan/publikasikan');
    
    // Isi feedback untuk siswa kedua agar lolos validasi publikasi mingguan
    await makeRequest('PUT', '/api/v1/mentor/rekap-mingguan/std-siswa2', mentorHeaders, {
      week_number: 3,
      tags: ['🤝 Kerjasama'],
      comments: 'Mampu berkolaborasi dengan baik'
    });

    const res = await makeRequest('POST', '/api/v1/mentor/rekap-mingguan/publikasikan', mentorHeaders, {
      week_number: 3
    });
    if (res.status === 200 && res.body.status === 'success') {
      console.log('✔ POST /api/v1/mentor/rekap-mingguan/publikasikan Lulus');
    } else {
      console.error('❌ POST /api/v1/mentor/rekap-mingguan/publikasikan Gagal:', res);
      testsFailed++;
    }
  } catch (err) {
    console.error('❌ POST /api/v1/mentor/rekap-mingguan/publikasikan Eror:', err);
    testsFailed++;
  }

  console.log('\n==================================================');
  if (testsFailed === 0) {
    console.log('🎉 SEMUA PENGUJIAN INTEGRASI CONTROLLER LULUS 100%!');
  } else {
    console.error(`❌ ${testsFailed} PENGUJIAN INTEGRASI CONTROLLER GAGAL.`);
  }
  console.log('==================================================');

  // Clean up
  await db.query("DELETE FROM pkl_mentor_daily_sessions WHERE mentor_id = 'usr-mentor' AND session_date = ?", [testDate]);
  await db.query("DELETE FROM pkl_daily_evaluations WHERE evaluation_date = ?", [testDate]);
  await db.query("UPDATE users SET device_id = NULL WHERE id = 'usr-student'");

  process.exit(testsFailed === 0 ? 0 : 1);
}

// Tunggu server up sepenuhnya
setTimeout(() => {
  runControllerTests().catch(err => {
    console.error('Eror fatal dalam integration test:', err);
    process.exit(1);
  });
}, 2000);
