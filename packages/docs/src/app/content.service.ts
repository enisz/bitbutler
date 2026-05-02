import { Injectable } from '@angular/core';
import hljs from 'highlight.js';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { type DocAttributes, deriveMetadata, parseFrontmatter } from './content.utils.js';

export type { DocAttributes } from './content.utils.js';

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
