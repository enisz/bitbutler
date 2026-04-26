import { TestBed } from '@angular/core/testing';
import { ServerService } from './server.service';

describe('ServerService', () => {
  let service: ServerService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ServerService] });
    service = TestBed.inject(ServerService);
  });

  it('should delegate list() to window.bitbutler.server.list', async () => {
    const servers = [{ id: '1', name: 'Test' }];
    vi.spyOn(window.bitbutler.server, 'list').mockResolvedValue(servers as any);
    const result = await service.list();
    expect(result).toEqual(servers);
  });

  it('should delegate add() to window.bitbutler.server.add', async () => {
    vi.spyOn(window.bitbutler.server, 'add').mockResolvedValue({ id: 'new-id' } as any);
    const result = await service.add({ name: 'New', host: 'http://localhost' } as any);
    expect(result).toEqual({ id: 'new-id' });
  });

  it('should return true from update() when server was updated', async () => {
    vi.spyOn(window.bitbutler.server, 'update').mockResolvedValue({ updated: true } as any);
    const result = await service.update('1', { name: 'Updated' });
    expect(result).toBe(true);
  });

  it('should return false from update() when server was not found', async () => {
    vi.spyOn(window.bitbutler.server, 'update').mockResolvedValue({ updated: false } as any);
    const result = await service.update('999', { name: 'X' });
    expect(result).toBe(false);
  });

  it('should return true from delete() when server was deleted', async () => {
    vi.spyOn(window.bitbutler.server, 'delete').mockResolvedValue({ deleted: true } as any);
    const result = await service.delete('1');
    expect(result).toBe(true);
  });

  it('should return false from delete() when server was not found', async () => {
    vi.spyOn(window.bitbutler.server, 'delete').mockResolvedValue({ deleted: false } as any);
    const result = await service.delete('999');
    expect(result).toBe(false);
  });

  it('should delegate getById() to window.bitbutler.server.getById', async () => {
    const server = { id: '1', name: 'Test' };
    vi.spyOn(window.bitbutler.server, 'getById').mockResolvedValue(server as any);
    const result = await service.getById('1');
    expect(result).toEqual(server);
  });

  it('should delegate getByHost() to window.bitbutler.server.getByHost', async () => {
    vi.spyOn(window.bitbutler.server, 'getByHost').mockResolvedValue(null);
    const result = await service.getByHost('http://unknown');
    expect(result).toBeNull();
  });
});
