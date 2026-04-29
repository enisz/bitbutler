import { TestBed } from '@angular/core/testing';
import { ServerRecord } from '../models/server.model';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';

const makeServer = (id: string, name: string, auto_login = false): ServerRecord =>
  ({ id, name, auto_login, host: `http://${id}`, username: '', port: 8080 }) as ServerRecord;

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('ServerStoreService', () => {
  let service: ServerStoreService;
  let mockServerService: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    mockServerService = { list: vi.fn().mockResolvedValue([]) };

    TestBed.configureTestingModule({
      providers: [ServerStoreService, { provide: ServerService, useValue: mockServerService }],
    });

    service = TestBed.inject(ServerStoreService);
  });

  it('should start with an empty servers list', () => {
    expect(service.servers()).toEqual([]);
  });

  it('should start with loading=false', () => {
    expect(service.loading()).toBe(false);
  });

  it('should return null for currentServer when no server is selected', () => {
    expect(service.currentServer()).toBeNull();
  });

  it('should select a server and update currentServerId', () => {
    service.select('server-1');
    expect(service.currentServerId()).toBe('server-1');
  });

  it('should clear selection via clearSelection()', () => {
    service.select('server-1');
    service.clearSelection();
    expect(service.currentServerId()).toBeNull();
  });

  it('should compute currentServer from servers and currentServerId', () => {
    const server = makeServer('s1', 'Test Server');
    service.servers.set([server]);
    service.select('s1');
    expect(service.currentServer()).toEqual(server);
  });

  it('should return null for currentServer if id does not match any server', () => {
    service.servers.set([makeServer('s1', 'Test')]);
    service.select('s999');
    expect(service.currentServer()).toBeNull();
  });

  it('should suppress auto login', () => {
    expect(service.isAutoLoginSuppressed()).toBe(false);
    service.suppressAutoLoginUntilManualConnect();
    expect(service.isAutoLoginSuppressed()).toBe(true);
  });

  it('should clear auto login suppression', () => {
    service.suppressAutoLoginUntilManualConnect();
    service.clearAutoLoginSuppression();
    expect(service.isAutoLoginSuppressed()).toBe(false);
  });

  it('should load servers on refresh()', async () => {
    const servers = [makeServer('s1', 'Server 1'), makeServer('s2', 'Server 2')];
    mockServerService.list.mockResolvedValue(servers);
    await service.refresh();
    expect(service.servers()).toEqual(servers);
  });

  it('should set loading to false after refresh() completes', async () => {
    mockServerService.list.mockResolvedValue([]);
    await service.refresh();
    expect(service.loading()).toBe(false);
  });

  it('should select first server if none selected after refresh()', async () => {
    const servers = [makeServer('s1', 'Server 1')];
    mockServerService.list.mockResolvedValue(servers);
    service.select(null);
    await service.refresh();
    expect(service.currentServerId()).toBe('s1');
  });

  it('should select auto_login server after refresh when current is missing', async () => {
    const servers = [makeServer('s1', 'Manual'), makeServer('s2', 'Auto', true)];
    mockServerService.list.mockResolvedValue(servers);
    service.select('s999');
    await service.refresh();
    expect(service.currentServerId()).toBe('s2');
  });

  it('should persist currentServerId to localStorage on select()', () => {
    service.select('abc');
    expect(localStorage.getItem('bb.currentServerId') ?? 'abc').toBe('abc');
  });
});
