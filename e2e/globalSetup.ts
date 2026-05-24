// e2e/globalSetup.ts
import * as path from 'node:path';
import {
  QB_HOST,
  QB_PASS,
  QB_PORT,
  QB_USER,
  addTorrent,
  changePassword,
  login,
  readTempPassword,
  startContainer,
  waitForReady,
} from './helpers/qbittorrent';

export default async function globalSetup(): Promise<void> {
  startContainer();
  await waitForReady();

  const tempPass = readTempPassword();
  const tempSid = await login(QB_USER, tempPass);
  await changePassword(tempSid, QB_PASS);

  const sid = await login(QB_USER, QB_PASS);
  const torrentPath = path.resolve(__dirname, 'fixtures/test.torrent');
  await addTorrent(sid, torrentPath);

  process.env['QB_HOST'] = QB_HOST;
  process.env['QB_PORT'] = String(QB_PORT);
  process.env['QB_USER'] = QB_USER;
  process.env['QB_PASS'] = QB_PASS;
}
