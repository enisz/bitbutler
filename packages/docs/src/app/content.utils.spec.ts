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
});
