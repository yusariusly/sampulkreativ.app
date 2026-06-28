async function seedUsers(dbClient) {
  console.log('[Seeder] Menjalankan seeder Users...');
  let createdCount = 0;

  const users = [
    { id: 'usr-admin', username: 'admin', password: 'admin', name: 'Administrator', role: 'admin' },
    { id: 'usr-mentor', username: 'mentor', password: 'mentor', name: 'Kak Pembimbing', role: 'mentor' },
    { id: 'usr-student', username: 'siswa', password: 'siswa', name: 'Siswa Magang 1', role: 'student' },
    { id: 'usr-student2', username: 'siswa2', password: 'siswa2', name: 'Siswa Magang 2', role: 'student' }
  ];

  for (const user of users) {
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM users WHERE id = ?', [user.id]);
    if (rows[0].cnt === 0) {
      await dbClient.query(
        'INSERT INTO users (id, username, password, nama_lengkap, role, is_active, foto_profile) VALUES (?, ?, ?, ?, ?, 1, ?)',
        [user.id, user.username, user.password, user.name, user.role, '/uploads/placeholder.jpg']
      );
      createdCount++;
    }
  }

  console.log(`[Seeder] Seeder Users selesai. Record dibuat: ${createdCount}`);
}

module.exports = { seedUsers };
