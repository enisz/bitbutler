import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Release, ReleaseAsset, UpdateCheckResponse } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MARKED_OPTIONS, MarkedOptions, MarkedRenderer, provideMarkdown } from 'ngx-markdown';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';
import { UpdateAvailable } from './update-available';

const makeRelease = (overrides: Partial<Release> = {}): Release =>
  ({
    tag_name: 'v2.0.0',
    name: '2.0.0',
    body: "## What's Changed\nFix bug A\n\nAdd feature B",
    published_at: '2024-01-15T10:00:00Z',
    assets: [],
    ...overrides,
  }) as Release;

const makeAsset = (overrides: Partial<ReleaseAsset> = {}): ReleaseAsset =>
  ({
    id: 1,
    name: 'bitbutler-1.0.0.exe',
    browser_download_url: 'https://example.com/bitbutler-1.0.0.exe',
    size: 1024,
    ...overrides,
  }) as ReleaseAsset;

function markedOptionsFactory(): MarkedOptions {
  const renderer = new MarkedRenderer();
  renderer.link = (link: any) => {
    const href = link.href || link;
    const text = link.text || link;
    return `<a href="${href}" target="_blank">${text}</a>`;
  };
  return {
    renderer: renderer,
    gfm: true,
    breaks: false,
    pedantic: false,
  };
}

describe('UpdateAvailable', () => {
  let component: UpdateAvailable;
  let fixture: ComponentFixture<UpdateAvailable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateAvailable],
      providers: [
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
        { provide: ThemeService, useValue: { family: signal('bitbutler') } },
        {
          provide: ElectronService,
          useValue: { openExternalUrl: vi.fn(), getPlatform: vi.fn().mockResolvedValue('win32') },
        },
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
        provideMarkdown({
          markedOptions: {
            provide: MARKED_OPTIONS,
            useFactory: markedOptionsFactory,
          },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateAvailable);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('update', {
      releases: [],
      updateAvailable: false,
    } as UpdateCheckResponse);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('cleanedBody', () => {
    it('should strip the "What\'s Changed" heading', () => {
      const release = makeRelease({ body: "## What's Changed\nFix A\nAdd B" });
      expect(component.cleanedBody(release)).toBe('Fix A\nAdd B');
    });

    it('should return body unchanged when there is no heading', () => {
      const release = makeRelease({ body: 'Fix A\nAdd B' });
      expect(component.cleanedBody(release)).toBe('Fix A\nAdd B');
    });

    it('should return empty string for empty body', () => {
      const release = makeRelease({ body: '' });
      expect(component.cleanedBody(release)).toBe('');
    });

    it('should trim trailing whitespace', () => {
      const release = makeRelease({ body: 'Fix A  \n  ' });
      expect(component.cleanedBody(release)).toBe('Fix A');
    });
  });

  describe('getVersion', () => {
    it('should strip leading v from version string', () => {
      expect(component.getVersion('v2.0.0')).toBe('2.0.0');
    });

    it('should return version unchanged when there is no leading v', () => {
      expect(component.getVersion('2.0.0')).toBe('2.0.0');
    });
  });

  describe('toMs', () => {
    it('should convert ISO date string to milliseconds', () => {
      const ms = component.toMs('2024-01-15T10:00:00Z');
      expect(ms).toBe(new Date('2024-01-15T10:00:00Z').getTime());
    });

    it('should return 0 for null', () => {
      expect(component.toMs(null)).toBe(0);
    });

    it('should return 0 for undefined', () => {
      expect(component.toMs(undefined)).toBe(0);
    });

    it('should return 0 for invalid date string', () => {
      expect(component.toMs('not-a-date')).toBe(0);
    });
  });

  describe('latestRelease', () => {
    it('should return the first release', () => {
      const r = makeRelease({ tag_name: 'v1.0.0' });
      fixture.componentRef.setInput('update', {
        releases: [r],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.latestRelease?.tag_name).toBe('v1.0.0');
    });

    it('should return undefined when no releases', () => {
      fixture.componentRef.setInput('update', {
        releases: [],
        updateAvailable: false,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.latestRelease).toBeUndefined();
    });
  });

  describe('itemId', () => {
    it('should prefix the release id', () => {
      expect(component.itemId(42)).toBe('release-42');
    });
  });

  describe('activeReleaseId', () => {
    it('should be null before any releases are set', () => {
      expect(component.activeReleaseId()).toBeNull();
    });

    it('should initialize to the first release id once releases are set', () => {
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ id: 7 }), makeRelease({ id: 8 })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.activeReleaseId()).toBe('release-7');
    });

    it('should not override a value that was already set', () => {
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ id: 7 })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      component.activeReleaseId.set('release-8');

      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ id: 7 }), makeRelease({ id: 9 })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();

      expect(component.activeReleaseId()).toBe('release-8');
    });
  });

  describe('platform', () => {
    it('should be set to the value resolved by ElectronService.getPlatform', async () => {
      await fixture.whenStable();
      expect(component.platform()).toBe('win32');
    });
  });

  describe('filteredAssets', () => {
    it('should only include assets matching the current platform on win32', () => {
      const assets = [
        makeAsset({ id: 1, name: 'bitbutler-1.0.0.exe' }),
        makeAsset({ id: 2, name: 'bitbutler-1.0.0.zip' }),
        makeAsset({ id: 3, name: 'bitbutler-1.0.0.AppImage' }),
        makeAsset({ id: 4, name: 'bitbutler-1.0.0.deb' }),
      ];
      component.platform.set('win32');
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ assets })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();

      expect(component.filteredAssets().map((asset) => asset.id)).toEqual([1, 2]);
    });

    it('should only include assets matching the current platform on linux', () => {
      const assets = [
        makeAsset({ id: 1, name: 'bitbutler-1.0.0.exe' }),
        makeAsset({ id: 2, name: 'bitbutler-1.0.0.AppImage' }),
        makeAsset({ id: 3, name: 'bitbutler-1.0.0.tar.gz' }),
      ];
      component.platform.set('linux');
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ assets })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();

      expect(component.filteredAssets().map((asset) => asset.id)).toEqual([2, 3]);
    });

    it('should fall back to showing all assets when the platform has no known extensions', () => {
      const assets = [
        makeAsset({ id: 1, name: 'bitbutler-1.0.0.exe' }),
        makeAsset({ id: 2, name: 'bitbutler-1.0.0.AppImage' }),
      ];
      component.platform.set('darwin');
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ assets })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();

      expect(component.filteredAssets().map((asset) => asset.id)).toEqual([1, 2]);
    });

    it('should fall back to showing all assets when none match the current platform', () => {
      const assets = [makeAsset({ id: 1, name: 'bitbutler-1.0.0.deb' })];
      component.platform.set('win32');
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ assets })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();

      expect(component.filteredAssets().map((asset) => asset.id)).toEqual([1]);
    });

    it('should show all assets when the platform is unknown', () => {
      const assets = [
        makeAsset({ id: 1, name: 'bitbutler-1.0.0.exe' }),
        makeAsset({ id: 2, name: 'bitbutler-1.0.0.AppImage' }),
      ];
      component.platform.set(null);
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ assets })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();

      expect(component.filteredAssets().map((asset) => asset.id)).toEqual([1, 2]);
    });
  });
});
