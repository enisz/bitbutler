// e2e/globalSetup.ts
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QB_HOST,
  QB_PASS,
  QB_PORT,
  QB_USER,
  addTorrent,
  changePassword,
  getTorrents,
  login,
  readTempPassword,
  startContainer,
  waitForReady,
} from './helpers/qbittorrent';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(): Promise<void> {
  startContainer();
  await new Promise((r) => setTimeout(r, 3000)); // wait for container to print temp password
  await waitForReady();

  const tempPass = readTempPassword();
  const tempSid = await login(QB_USER, tempPass);
  await changePassword(tempSid, QB_PASS);

  const sid = await login(QB_USER, QB_PASS);
  const torrentPath = path.resolve(__dirname, 'fixtures/test.torrent');
  await addTorrent(sid, torrentPath);

  const torrents = await getTorrents(sid);
  const fixture = torrents.find((t) => t.name === 'test-files');
  if (fixture) process.env['FIXTURE_HASH'] = fixture.hash;

  process.env['QB_HOST'] = QB_HOST;
  process.env['QB_PORT'] = String(QB_PORT);
  process.env['QB_USER'] = QB_USER;
  process.env['QB_PASS'] = QB_PASS;
}
