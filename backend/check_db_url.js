require('dotenv').config({ path: '/home/yusarius/Absensi_Software/application_absensi_v2/backend/.env' });
console.log('DATABASE_URL contains timezone:', process.env.DATABASE_URL.includes('timezone'));
console.log('DATABASE_URL structure (masked):', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':masked@'));
