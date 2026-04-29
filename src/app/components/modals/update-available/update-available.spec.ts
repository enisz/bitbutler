import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Release, UpdateCheckResponse } from '../../../models/electron.model';
import { ElectronService } from '../../../services/electron.service';
import { ThemeService } from '../../../services/theme.service';
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

describe('UpdateAvailable', () => {
  let component: UpdateAvailable;
  let fixture: ComponentFixture<UpdateAvailable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateAvailable],
      providers: [
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
        { provide: ThemeService, useValue: { family: signal('bitbutler') } },
        { provide: ElectronService, useValue: { openExternalUrl: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateAvailable);
    component = fixture.componentInstance;
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

  describe('isSingleRelease', () => {
    it('should be true when exactly one release is present', () => {
      component.update.set({
        releases: [makeRelease()],
        updateAvailable: true,
      } as UpdateCheckResponse);
      expect(component.isSingleRelease()).toBe(true);
    });

    it('should be false when more than one release is present', () => {
      component.update.set({
        releases: [makeRelease(), makeRelease()],
        updateAvailable: true,
      } as UpdateCheckResponse);
      expect(component.isSingleRelease()).toBe(false);
    });

    it('should be false when no releases are present', () => {
      component.update.set({ releases: [], updateAvailable: false } as UpdateCheckResponse);
      expect(component.isSingleRelease()).toBe(false);
    });
  });

  describe('latestRelease', () => {
    it('should return the first release', () => {
      const r = makeRelease({ tag_name: 'v1.0.0' });
      component.update.set({ releases: [r], updateAvailable: true } as UpdateCheckResponse);
      expect(component.latestRelease?.tag_name).toBe('v1.0.0');
    });

    it('should return undefined when no releases', () => {
      component.update.set({ releases: [], updateAvailable: false } as UpdateCheckResponse);
      expect(component.latestRelease).toBeUndefined();
    });
  });
});
