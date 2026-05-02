import { Injectable } from '@angular/core';
import hljs from 'highlight.js';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';

export interface DocAttributes {
  title: string;
  order: number;
}

export interface DocFile {
  filename: string;
  slug: string;
  folder: string | null;
  attributes: DocAttributes;
  body: string;
  html: string;
}

marked.use(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  }),
);

const rawFiles = import.meta.glob('../content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function parseFrontmatter(raw: string): { attributes: DocAttributes; body: string } {
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

function deriveMetadata(filename: string): { slug: string; folder: string | null } {
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

@Injectable({ providedIn: 'root' })
export class ContentService {
  readonly files: DocFile[];

  constructor() {
    this.files = Object.entries(rawFiles).map(([filename, raw]) => {
      const { attributes, body } = parseFrontmatter(raw as string);
      const { slug, folder } = deriveMetadata(filename);
      const html = marked(body) as string;
      return { filename, slug, folder, attributes, body, html };
    });
  }

  getFile(slug: string): DocFile | undefined {
    return this.files.find((f) => f.slug === slug);
  }
}
