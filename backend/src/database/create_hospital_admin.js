process.env.ADMIN_ROLE = 'hospital_admin';
const { main } = require('../../scripts/bootstrap-admin');
main().catch(error => { console.error(`Administrator bootstrap failed: ${error.message}`); process.exitCode = 1; });
