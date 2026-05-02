import { Injectable } from '@angular/core';
import hljs from 'highlight.js';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';

export interface DocAttributes {
  title: string;
  order: number;
  slug: string;
  parent?: string;
}

export interface DocFile {
  filename: string;
  slug: string;
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

const rawFiles = import.meta.glob('../content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function parseFrontmatter(raw: string): { attributes: DocAttributes; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { attributes: { title: '', order: 0, slug: '' }, body: raw };

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
    else (attrs as Record<string, string>)[key] = val;
  }

  return { attributes: attrs as DocAttributes, body: match[2].trim() };
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  readonly files: DocFile[] = Object.entries(rawFiles)
    .map(([filename, raw]) => {
      const { attributes, body } = parseFrontmatter(raw as string);
      const slug = attributes.slug || filename.split('/').pop()!.replace(/\.md$/, '');
      const html = marked(body) as string;
      return { filename, slug, attributes: { ...attributes, slug }, body, html };
    })
    .sort((a, b) => (a.attributes.order ?? 99) - (b.attributes.order ?? 99));

  getFile(slug: string): DocFile | undefined {
    return this.files.find((f) => f.slug === slug);
  }
}
