async function seedSettings(dbClient) {
  console.log('[Seeder] Menjalankan seeder Settings...');
  let createdCount = 0;

  const settings = [
    { key_name: 'deadline_time', key_value: '08:30' },
    { key_name: 'checkout_time', key_value: '17:00' },
    { key_name: 'telegram_bot_token', key_value: '' },
    { key_name: 'telegram_chat_id', key_value: '' },
    { key_name: 'smtp_host', key_value: '' },
    { key_name: 'smtp_port', key_value: '587' },
    { key_name: 'smtp_user', key_value: '' },
    { key_name: 'smtp_pass', key_value: '' },
    { key_name: 'smtp_to', key_value: '' },
    { key_name: 'smtp_sender', key_value: '' }
  ];

  for (const setting of settings) {
    const [rows] = await dbClient.query('SELECT COUNT(*) as cnt FROM settings WHERE key_name = ?', [setting.key_name]);
    if (rows[0].cnt === 0) {
      await dbClient.query('INSERT INTO settings (key_name, key_value) VALUES (?, ?)', [setting.key_name, setting.key_value]);
      createdCount++;
    }
  }

  console.log(`[Seeder] Seeder Settings selesai. Record dibuat: ${createdCount}`);
}

module.exports = { seedSettings };
