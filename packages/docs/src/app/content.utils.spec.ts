import { describe, expect, it } from 'vitest';
import { deriveMetadata, parseFrontmatter } from './content.utils.js';

describe('parseFrontmatter', () => {
  it('parses title and order from frontmatter block', () => {
    const raw = `---\ntitle: Getting Started\norder: 1\n---\nSome content here`;
    const { attributes, body } = parseFrontmatter(raw);
    expect(attributes.title).toBe('Getting Started');
    expect(attributes.order).toBe(1);
    expect(body).toBe('Some content here');
  });

  it('returns empty defaults when no frontmatter is present', () => {
    const raw = 'Just plain content';
    const { attributes, body } = parseFrontmatter(raw);
    expect(attributes.title).toBe('');
    expect(attributes.order).toBe(0);
    expect(body).toBe('Just plain content');
  });

  it('handles CRLF line endings in the frontmatter block', () => {
    const raw = `---\r\ntitle: CRLF Test\r\norder: 5\r\n---\r\nContent here`;
    const { attributes, body } = parseFrontmatter(raw);
    expect(attributes.title).toBe('CRLF Test');
    expect(attributes.order).toBe(5);
    expect(body).toBe('Content here');
  });

  it('strips double quotes from string values', () => {
    const raw = `---\ntitle: "Quoted Title"\norder: 2\n---\nBody`;
    const { attributes } = parseFrontmatter(raw);
    expect(attributes.title).toBe('Quoted Title');
  });

  it('strips single quotes from string values', () => {
    const raw = `---\ntitle: 'Single Quoted'\norder: 3\n---\nBody`;
    const { attributes } = parseFrontmatter(raw);
    expect(attributes.title).toBe('Single Quoted');
  });

  it('preserves colons that appear within a value', () => {
    const raw = `---\ntitle: Hello: World\norder: 1\n---\nBody`;
    const { attributes } = parseFrontmatter(raw);
    expect(attributes.title).toBe('Hello: World');
  });

  it('leaves title undefined when only order is present in frontmatter', () => {
    const raw = `---\norder: 3\n---\nContent`;
    const { attributes } = parseFrontmatter(raw);
    expect(attributes.title).toBeUndefined();
    expect(attributes.order).toBe(3);
  });

  it('leaves order undefined when only title is present in frontmatter', () => {
    const raw = `---\ntitle: Only Title\n---\nContent`;
    const { attributes } = parseFrontmatter(raw);
    expect(attributes.order).toBeUndefined();
    expect(attributes.title).toBe('Only Title');
  });

  it('trims whitespace from the body', () => {
    const raw = `---\ntitle: T\norder: 1\n---\n  trimmed  `;
    const { body } = parseFrontmatter(raw);
    expect(body).toBe('trimmed');
  });

  it('returns empty string body when content after frontmatter is only whitespace', () => {
    const raw = `---\ntitle: Empty\norder: 1\n---\n   `;
    const { body } = parseFrontmatter(raw);
    expect(body).toBe('');
  });

  it('preserves multi-line body content', () => {
    const raw = `---\ntitle: T\norder: 1\n---\nLine one\nLine two`;
    const { body } = parseFrontmatter(raw);
    expect(body).toBe('Line one\nLine two');
  });

  it('ignores unknown frontmatter keys', () => {
    const raw = `---\ntitle: T\norder: 1\nunknown: value\n---\nBody`;
    const { attributes } = parseFrontmatter(raw);
    expect(attributes.title).toBe('T');
    expect(attributes.order).toBe(1);
  });

  it('parses order: 0 correctly (not treated as falsy)', () => {
    const raw = `---\ntitle: Root\norder: 0\n---\nBody`;
    const { attributes } = parseFrontmatter(raw);
    expect(attributes.order).toBe(0);
  });
});

describe('deriveMetadata', () => {
  it('returns null folder and bare slug for a root-level file', () => {
    const { slug, folder } = deriveMetadata('../content/introduction.md');
    expect(slug).toBe('introduction');
    expect(folder).toBeNull();
  });

  it('strips numeric ordering prefix from folder in the slug', () => {
    const { slug, folder } = deriveMetadata('../content/01-getting-started/installation.md');
    expect(slug).toBe('getting-started/installation');
    expect(folder).toBe('01-getting-started');
  });

  it('preserves the raw folder name in the folder field', () => {
    const { folder } = deriveMetadata('../content/02-advanced/deep-dive.md');
    expect(folder).toBe('02-advanced');
  });

  it('strips multi-digit ordering prefixes', () => {
    const { slug } = deriveMetadata('../content/100-reference/api.md');
    expect(slug).toBe('reference/api');
  });

  it('does not alter a folder that has no numeric prefix', () => {
    const { slug, folder } = deriveMetadata('../content/guides/quickstart.md');
    expect(slug).toBe('guides/quickstart');
    expect(folder).toBe('guides');
  });

  it('removes the .md extension from root-level filenames', () => {
    const { slug } = deriveMetadata('../content/changelog.md');
    expect(slug).toBe('changelog');
  });

  it('removes the .md extension from nested filenames', () => {
    const { slug } = deriveMetadata('../content/01-setup/quick-start.md');
    expect(slug).toBe('setup/quick-start');
  });

  it('handles filenames with hyphens correctly', () => {
    const { slug } = deriveMetadata('../content/03-config/advanced-options.md');
    expect(slug).toBe('config/advanced-options');
  });
});
