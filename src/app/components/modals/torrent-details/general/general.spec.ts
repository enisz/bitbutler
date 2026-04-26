import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { CommandBusService } from '../../../../services/command-bus.service';
import { GeneralSettingsService } from '../../../../services/general-settings.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { General } from './general';

describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap: signal(new Map()) },
        },
        {
          provide: QbService,
          useValue: {
            torrentProperties: vi.fn().mockResolvedValue({}),
            torrentContents: vi.fn().mockResolvedValue([]),
            renameTorrent: vi.fn(),
            renameTorrentFile: vi.fn(),
            renameTorrentFolder: vi.fn(),
            setDownloadLimit: vi.fn(),
            setUploadLimit: vi.fn(),
            setShareLimits: vi.fn(),
            setTorrentCategory: vi.fn(),
            addTorrentTags: vi.fn(),
            removeTorrentTags: vi.fn(),
            forceReannounce: vi.fn(),
          },
        },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
        {
          provide: GeneralSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({ behavior: {} }),
            asObservable: vi.fn().mockReturnValue(of({ behavior: {} })),
          },
        },
        { provide: PathService, useValue: { resolveLocalPath: vi.fn().mockResolvedValue(null) } },
        { provide: Clipboard, useValue: { copy: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with null torrent', () => {
    expect(component.torrent()).toBeNull();
  });

  it('should start with null properties', () => {
    expect(component.properties()).toBeNull();
  });

  it('should start with singleFile = false', () => {
    expect(component.singleFile()).toBe(false);
  });
});
