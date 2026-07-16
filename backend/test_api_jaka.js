async function main() {
  const res = await fetch('http://localhost:3000/api/attendance');
  if (res.ok) {
    const data = await res.json();
    const jakaLogs = data.filter(l => l.nama_lengkap.includes('Jaka')).slice(0, 10);
    console.log('=== Top 10 API output for Jaka ===');
    console.log(JSON.stringify(jakaLogs, null, 2));
  } else {
    console.error('Failed to fetch from API');
  }
}

main().catch(console.error);
