// e2e/fixtures/generate-torrent.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function bencode(value) {
  if (typeof value === 'number') return Buffer.from(`i${value}e`);
  if (Buffer.isBuffer(value)) return Buffer.concat([Buffer.from(`${value.length}:`), value]);
  if (typeof value === 'string') {
    const buf = Buffer.from(value, 'utf8');
    return Buffer.concat([Buffer.from(`${buf.length}:`), buf]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([Buffer.from('l'), ...value.map(bencode), Buffer.from('e')]);
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value).sort();
    return Buffer.concat([
      Buffer.from('d'),
      ...keys.flatMap((k) => [bencode(k), bencode(value[k])]),
      Buffer.from('e'),
    ]);
  }
  throw new Error(`Cannot bencode ${typeof value}`);
}

const helloContent = Buffer.from('hello');
const worldContent = Buffer.from('world');
const pieceLength = 262144;
// For tiny files a single piece covers everything - SHA1 placeholder (zeros accepted by qB for paused torrents)
const pieces = Buffer.alloc(20);

const torrent = {
  info: {
    name: 'test-files',
    'piece length': pieceLength,
    pieces,
    files: [
      { length: helloContent.length, path: ['hello.txt'] },
      { length: worldContent.length, path: ['world.txt'] },
    ],
  },
};

const outPath = join(__dirname, 'test.torrent');
writeFileSync(outPath, bencode(torrent));
console.log(`Written ${outPath} (${bencode(torrent).length} bytes)`);
