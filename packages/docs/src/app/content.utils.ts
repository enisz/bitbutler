export interface DocAttributes {
  title: string;
  order: number;
}

export function parseFrontmatter(raw: string): { attributes: DocAttributes; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { attributes: { title: '', order: 0 }, body: raw };

  const attrs: Partial<DocAttributes> = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line
      .slice(colon + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key === 'order') attrs.order = Number(val);
    else if (key === 'title') attrs.title = val;
  }

  return { attributes: attrs as DocAttributes, body: match[2].trim() };
}

export function deriveMetadata(filename: string): { slug: string; folder: string | null } {
  const relative = filename.replace(/^\.\.\/content\//, '');
  const parts = relative.split('/');

  if (parts.length === 1) {
    return { slug: parts[0].replace(/\.md$/, ''), folder: null };
  }

  const folder = parts[0];
  const file = parts[1].replace(/\.md$/, '');
  // Strip numeric ordering prefix from folder for clean URL slugs
  const slugFolder = folder.replace(/^\d+-/, '');

  return { slug: `${slugFolder}/${file}`, folder };
}
