async function main() {
  const res = await fetch('http://localhost:3000/api/attendance');
  if (res.ok) {
    const data = await res.json();
    const jakaLogs = data.filter(l => l.nama_lengkap.includes('Jaka') && (l.waktu_absen.startsWith('2026-07-15') || l.waktu_absen.startsWith('2026-07-16')));
    console.log('=== API output for Jaka ===');
    console.log(JSON.stringify(jakaLogs, null, 2));
  } else {
    console.error('Failed to fetch from API');
  }
}

main().catch(console.error);
