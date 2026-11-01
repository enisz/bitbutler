import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as labels from './labels.js';

const mockQbCall = vi.fn();

vi.mock('./client.js', () => ({ qbCall: (...args: unknown[]) => mockQbCall(...args) }));

describe('tags and categories domain', () => {
  beforeEach(() => {
    mockQbCall.mockReset();
    mockQbCall.mockResolvedValue(undefined);
  });

  describe('request shape', () => {
    const hashes = [' a ', '', 'b'];
    const tags = [' x ', '', 'y'];

    it.each([
      [
        'addTags',
        () => labels.addTags('s', hashes, tags),
        'addTags',
        { hashes: 'a|b', tags: 'x,y' },
      ],
      [
        'removeTags',
        () => labels.removeTags('s', hashes, tags),
        'removeTags',
        { hashes: 'a|b', tags: 'x,y' },
      ],
      ['removeAllTags', () => labels.removeAllTags('s', hashes), 'removeTags', { hashes: 'a|b' }],
      ['createTags', () => labels.createTags('s', tags), 'createTags', { tags: 'x,y' }],
      ['deleteTags', () => labels.deleteTags('s', tags), 'deleteTags', { tags: 'x,y' }],
      [
        'setCategory',
        () => labels.setCategory('s', hashes, 'movies'),
        'setCategory',
        { hashes: 'a|b', category: 'movies' },
      ],
      [
        'clearCategory',
        () => labels.clearCategory('s', hashes),
        'setCategory',
        { hashes: 'a|b', category: '' },
      ],
      [
        'createCategory',
        () => labels.createCategory('s', 'movies', '/data'),
        'createCategory',
        { category: 'movies', savePath: '/data' },
      ],
      [
        'editCategory',
        () => labels.editCategory('s', 'movies', '/data'),
        'editCategory',
        { category: 'movies', savePath: '/data' },
      ],
      [
        'removeCategories',
        () => labels.removeCategories('s', [' a ', '', 'b']),
        'removeCategories',
        { categories: 'a|b' },
      ],
    ])('%s posts the cleaned form', async (_name, run, endpoint, form) => {
      await run();
      expect(mockQbCall).toHaveBeenCalledWith('s', {
        method: 'POST',
        path: `/api/v2/torrents/${endpoint}`,
        form,
      });
    });
  });

  describe('reads', () => {
    it('tags GETs the tag list', async () => {
      mockQbCall.mockResolvedValue(['a', 'b']);
      await expect(labels.tags('s')).resolves.toEqual(['a', 'b']);
      expect(mockQbCall).toHaveBeenCalledWith('s', {
        method: 'GET',
        path: '/api/v2/torrents/tags',
      });
    });

    it('categories GETs the category map', async () => {
      const map = { movies: { name: 'movies', savePath: '/data' } };
      mockQbCall.mockResolvedValue(map);
      await expect(labels.categories('s')).resolves.toEqual(map);
      expect(mockQbCall).toHaveBeenCalledWith('s', {
        method: 'GET',
        path: '/api/v2/torrents/categories',
      });
    });
  });

  describe('no-ops', () => {
    it.each([
      ['addTags blank tags', () => labels.addTags('s', ['a'], [' ', ''])],
      ['addTags no hashes', () => labels.addTags('s', [' '], ['x'])],
      ['removeTags blank tags', () => labels.removeTags('s', ['a'], [' '])],
      ['removeTags no hashes', () => labels.removeTags('s', [], ['x'])],
      ['removeAllTags no hashes', () => labels.removeAllTags('s', [''])],
      ['createTags blank tags', () => labels.createTags('s', [' '])],
      ['deleteTags blank tags', () => labels.deleteTags('s', [])],
      ['setCategory no hashes', () => labels.setCategory('s', [], 'c')],
      ['clearCategory no hashes', () => labels.clearCategory('s', [' '])],
      ['removeCategories blank', () => labels.removeCategories('s', [' ', ''])],
    ])('%s resolves without calling qbCall', async (_name, run) => {
      await expect(run()).resolves.toBeUndefined();
      expect(mockQbCall).not.toHaveBeenCalled();
    });
  });
});
