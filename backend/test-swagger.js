const http = require('http');
const app = require('./index.js'); // Mengimpor konfigurasi app Express

const TEST_PORT = 5006;
let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[TEST-SWAGGER] Server uji berjalan pada port ${TEST_PORT}`);
      resolve();
    });
  });
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  try {
    await startServer();

    console.log('\n==================================================');
    console.log('Mulai Pengujian Rute Dokumentasi Swagger/OpenAPI...');
    console.log('==================================================');

    // Test 1: GET /api-docs/ (Swagger UI HTML)
    console.log('[TEST 1] GET /api-docs/ (HTML UI)');
    const resHtml = await fetchUrl(`http://localhost:${TEST_PORT}/api-docs/`);
    if (resHtml.statusCode === 200 && resHtml.data.includes('<html') && resHtml.data.includes('swagger-ui')) {
      console.log('✔ GET /api-docs/ Lulus (HTML UI disajikan dengan benar)');
    } else {
      throw new Error(`Gagal memuat HTML Swagger UI. Status: ${resHtml.statusCode}`);
    }

    // Test 2: GET /api-docs/swagger-ui-init.js (Inisialisasi Dokumen OpenAPI JSON)
    console.log('\n[TEST 2] GET /api-docs/swagger-ui-init.js');
    const resJs = await fetchUrl(`http://localhost:${TEST_PORT}/api-docs/swagger-ui-init.js`);
    if (resJs.statusCode === 200 && resJs.data.includes('SampulKreativ PKL Activity API')) {
      console.log('✔ GET /api-docs/swagger-ui-init.js Lulus (Data OpenAPI disematkan dengan benar)');
    } else {
      throw new Error(`Gagal memuat JSON data inisialisasi Swagger. Status: ${resJs.statusCode}`);
    }

    console.log('\n==================================================');
    console.log('🎉 SEMUA PENGUJIAN SWAGGER/OPENAPI LULUS 100%!');
    console.log('==================================================\n');
    cleanup(0);
  } catch (error) {
    console.error('\n❌ PENGUJIAN SWAGGER GAGAL:', error.message);
    cleanup(1);
  }
}

function cleanup(exitCode) {
  if (server) {
    server.close(() => {
      console.log('[TEST-SWAGGER] Server uji dihentikan.');
      process.exit(exitCode);
    });
  } else {
    process.exit(exitCode);
  }
}

// Jalankan pengujian
runTests();
