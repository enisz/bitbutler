import type { AppCommand, CategoryCommand, TagCommand } from './command.model';

describe('command.model', () => {
  it('accepts TagCommand and CategoryCommand as AppCommand', () => {
    const tagAdded: AppCommand = { type: 'TAG_ADDED', names: ['linux', 'ubuntu'] };
    const tagDeleted: AppCommand = { type: 'TAG_DELETED', names: ['linux'] };
    const categoryAdded: AppCommand = {
      type: 'CATEGORY_ADDED',
      name: 'movies',
      savePath: '/data/movies',
    };
    const categoryUpdated: AppCommand = {
      type: 'CATEGORY_UPDATED',
      name: 'movies',
      savePath: '/data/movies2',
    };
    const categoryDeleted: AppCommand = { type: 'CATEGORY_DELETED', names: ['movies'] };

    const tag: TagCommand = tagAdded;
    const category: CategoryCommand = categoryAdded;

    expect(tag.type).toBe('TAG_ADDED');
    expect(category.type).toBe('CATEGORY_ADDED');
    expect(tagDeleted.type).toBe('TAG_DELETED');
    expect(categoryUpdated.type).toBe('CATEGORY_UPDATED');
    expect(categoryDeleted.type).toBe('CATEGORY_DELETED');
  });
});
