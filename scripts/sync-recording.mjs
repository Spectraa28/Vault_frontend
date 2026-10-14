// Copies a recorded game from the back end into the front end, for the hands-free tour (?replay=auto).
//   node scripts/sync-recording.mjs ../path/to/Vault_backend/web/mock-run.json
import { copyFile } from 'node:fs/promises';
const from = process.argv[2];
if (!from) { console.error('Give the path to the back end\'s web/mock-run.json.'); process.exit(1); }
await copyFile(from, new URL('../public/recordings/mock-run.json', import.meta.url));
console.log('Copied', from);
