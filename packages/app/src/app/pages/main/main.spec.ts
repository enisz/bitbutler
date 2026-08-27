import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { Main } from './main';

describe('Main', () => {
  let component: Main;
  let fixture: ComponentFixture<Main>;

  let themeMock: {
    family: ReturnType<typeof signal<string>>;
    effectiveMode: ReturnType<typeof signal<'dark' | 'light'>>;
  };
  let serverStoreMock: {
    currentServer: ReturnType<typeof signal<any>>;
    currentServerId: ReturnType<typeof signal<string | null>>;
    refresh: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  let torrentStoreMock: {
    applyMaindata: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: ThemeService, useValue: themeMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        {
          provide: QbPollingService,
          useValue: { startMaindataPolling: vi.fn().mockReturnValue(new Subject()) },
        },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Main, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();

    fixture = TestBed.createComponent(Main);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    themeMock = {
      family: signal('bitbutler'),
      effectiveMode: signal<'dark' | 'light'>('dark'),
    };
    serverStoreMock = {
      currentServer: signal(null),
      currentServerId: signal(null),
      refresh: vi.fn().mockResolvedValue(undefined),
    };
    torrentStoreMock = {
      applyMaindata: vi.fn(),
      clear: vi.fn(),
    };
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  describe('theme', () => {
    it('should be the effectiveMode signal from ThemeService', async () => {
      await createComponent();
      expect(component.theme).toBe(themeMock.effectiveMode);
    });
  });

  describe('currentServer', () => {
    it('should be the currentServer signal from ServerStoreService', async () => {
      await createComponent();
      expect(component.currentServer).toBe(serverStoreMock.currentServer);
    });
  });

  describe('serverState', () => {
    it('should be null initially', async () => {
      await createComponent();
      expect(component.serverState()).toBeNull();
    });
  });

  describe('server switch', () => {
    it('should clear the torrent store before starting to poll a server', async () => {
      await createComponent();
      expect(torrentStoreMock.clear).not.toHaveBeenCalled();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      expect(torrentStoreMock.clear).toHaveBeenCalledTimes(1);
    });

    it('should clear the torrent store again on a subsequent switch to another server', async () => {
      await createComponent();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      serverStoreMock.currentServerId.set('server-2');
      fixture.detectChanges();

      expect(torrentStoreMock.clear).toHaveBeenCalledTimes(2);
    });
  });
});
