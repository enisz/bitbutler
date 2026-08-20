import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Release, ReleaseAsset, UpdateCheckResponse } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MARKED_OPTIONS, MarkedOptions, MarkedRenderer, provideMarkdown } from 'ngx-markdown';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import { ElectronService } from '../../services/electron.service';
import { UpdateSettingsService } from '../../services/update-settings.service';
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
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let updateSettingsSave: ReturnType<typeof vi.fn>;
  let openExternalUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    activeModal = { close: vi.fn(), dismiss: vi.fn() };
    updateSettingsSave = vi.fn().mockResolvedValue(undefined);
    openExternalUrl = vi.fn();

    await TestBed.configureTestingModule({
      imports: [UpdateAvailable],
      providers: [
        { provide: NgbActiveModal, useValue: activeModal },
        {
          provide: ElectronService,
          useValue: {
            openExternalUrl,
            getPlatform: vi.fn().mockResolvedValue('win32'),
          },
        },
        { provide: UpdateSettingsService, useValue: { save: updateSettingsSave } },
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

  describe('release date rendering', () => {
    it('renders the release date using the configured date format', () => {
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ published_at: '2024-01-15T10:00:00Z' })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();

      const dateSpan = fixture.nativeElement.querySelector('.bb-ua-version-date');
      expect(dateSpan.textContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it('renders a parenthesized relative time-ago suffix next to the date', () => {
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ published_at: '2024-01-15T10:00:00Z' })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();

      const agoSpan = fixture.nativeElement.querySelector('.bb-ua-version-date__ago');
      expect(agoSpan.textContent.trim()).toMatch(/^\(.+\)$/);
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

  describe('osLabel', () => {
    it('should map win32 to Windows', () => {
      component.platform.set('win32');
      expect(component.osLabel()).toBe('Windows');
    });

    it('should map darwin to macOS', () => {
      component.platform.set('darwin');
      expect(component.osLabel()).toBe('macOS');
    });

    it('should map linux to Linux', () => {
      component.platform.set('linux');
      expect(component.osLabel()).toBe('Linux');
    });

    it('should be null for an unmapped platform', () => {
      component.platform.set('aix');
      expect(component.osLabel()).toBeNull();
    });

    it('should be null when the platform is unknown', () => {
      component.platform.set(null);
      expect(component.osLabel()).toBeNull();
    });
  });

  describe('currentVersion', () => {
    it('should reflect the normalized currentVersion from the update response', () => {
      fixture.componentRef.setInput('update', {
        releases: [],
        updateAvailable: false,
        currentVersion: 'v1.1.0',
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.currentVersion()).toBe('1.1.0');
    });

    it('should be null when the update response has no currentVersion', () => {
      fixture.componentRef.setInput('update', {
        releases: [],
        updateAvailable: false,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.currentVersion()).toBeNull();
    });
  });

  describe('behindCount', () => {
    it('should reflect the number of missed releases', () => {
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ id: 1 }), makeRelease({ id: 2 })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.behindCount()).toBe(2);
    });

    it('should be 0 when there are no releases', () => {
      expect(component.behindCount()).toBe(0);
    });
  });

  describe('skipVersions', () => {
    it('should persist the normalized latest release version and close the modal', async () => {
      fixture.componentRef.setInput('update', {
        releases: [makeRelease({ tag_name: 'v2.0.0' })],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();

      await component.skipVersions();

      expect(updateSettingsSave).toHaveBeenCalledWith({ skippedVersion: '2.0.0' });
      expect(activeModal.close).toHaveBeenCalledWith('skip');
    });

    it('should close the modal without saving when there is no latest release', async () => {
      await component.skipVersions();

      expect(updateSettingsSave).not.toHaveBeenCalled();
      expect(activeModal.close).toHaveBeenCalledWith('skip');
    });
  });

  describe('viewAllReleases', () => {
    it('should open the releases list page, not a specific release tag', () => {
      component.viewAllReleases();
      expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/enisz/bitbutler/releases');
    });
  });
});
