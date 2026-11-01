import type { QbCategory } from '@bitbutler/shared';
import { qbCall } from './client.js';
import { cleanHashes } from './hashes.js';

async function post(
  serverId: string,
  endpoint: string,
  form: Record<string, string>,
): Promise<void> {
  await qbCall<void>(serverId, { method: 'POST', path: `/api/v2/torrents/${endpoint}`, form });
}

// Trims every entry, drops blanks and joins the rest with `separator`.
function joinClean(values: string[] | undefined, separator: string): string {
  return (values ?? [])
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(separator);
}

export async function tags(serverId: string): Promise<string[]> {
  return qbCall<string[]>(serverId, { method: 'GET', path: '/api/v2/torrents/tags' });
}

export async function createTags(serverId: string, names: string[]): Promise<void> {
  const joined = joinClean(names, ',');
  if (!joined) return;
  await post(serverId, 'createTags', { tags: joined });
}

export async function deleteTags(serverId: string, names: string[]): Promise<void> {
  const joined = joinClean(names, ',');
  if (!joined) return;
  await post(serverId, 'deleteTags', { tags: joined });
}

export async function addTags(serverId: string, hashes: string[], names: string[]): Promise<void> {
  const joinedHashes = cleanHashes(hashes);
  if (!joinedHashes) return;
  const joinedTags = joinClean(names, ',');
  if (!joinedTags) return;
  await post(serverId, 'addTags', { hashes: joinedHashes, tags: joinedTags });
}

export async function removeTags(
  serverId: string,
  hashes: string[],
  names: string[],
): Promise<void> {
  const joinedHashes = cleanHashes(hashes);
  if (!joinedHashes) return;
  const joinedTags = joinClean(names, ',');
  if (!joinedTags) return;
  await post(serverId, 'removeTags', { hashes: joinedHashes, tags: joinedTags });
}

// removeTags without a `tags` field removes every tag from the torrents.
export async function removeAllTags(serverId: string, hashes: string[]): Promise<void> {
  const joinedHashes = cleanHashes(hashes);
  if (!joinedHashes) return;
  await post(serverId, 'removeTags', { hashes: joinedHashes });
}

export async function categories(serverId: string): Promise<Record<string, QbCategory>> {
  return qbCall<Record<string, QbCategory>>(serverId, {
    method: 'GET',
    path: '/api/v2/torrents/categories',
  });
}

export async function createCategory(
  serverId: string,
  category: string,
  savePath: string,
): Promise<void> {
  await post(serverId, 'createCategory', { category, savePath });
}

export async function editCategory(
  serverId: string,
  category: string,
  savePath: string,
): Promise<void> {
  await post(serverId, 'editCategory', { category, savePath });
}

export async function removeCategories(serverId: string, names: string[]): Promise<void> {
  const joined = joinClean(names, '|');
  if (!joined) return;
  await post(serverId, 'removeCategories', { categories: joined });
}

export async function setCategory(
  serverId: string,
  hashes: string[],
  category: string,
): Promise<void> {
  const joinedHashes = cleanHashes(hashes);
  if (!joinedHashes) return;
  await post(serverId, 'setCategory', { hashes: joinedHashes, category });
}

export const clearCategory = (serverId: string, hashes: string[]): Promise<void> =>
  setCategory(serverId, hashes, '');
