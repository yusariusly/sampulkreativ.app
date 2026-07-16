console.log('Node.js timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('process.env.TZ:', process.env.TZ);
console.log('Current local Date string:', new Date().toString());
console.log('Current UTC Date ISO string:', new Date().toISOString());
