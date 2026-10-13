import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../../web/mock-run.json', import.meta.url), new URL('../public/recordings/mock-run.json', import.meta.url));
console.log('Copied the API recording unchanged.');
