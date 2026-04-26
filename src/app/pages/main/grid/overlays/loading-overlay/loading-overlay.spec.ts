import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingOverlay } from './loading-overlay';

describe('LoadingOverlay', () => {
  let component: LoadingOverlay;
  let fixture: ComponentFixture<LoadingOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingOverlay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default title and message', () => {
    expect(component.title).toBe('Loading…');
    expect(component.message).toBe('Fetching data from qBittorrent');
  });

  it('agInit should set title and message from params', () => {
    component.agInit({ title: 'Custom Title', message: 'Custom Message' } as any);
    expect(component.title).toBe('Custom Title');
    expect(component.message).toBe('Custom Message');
  });

  it('agInit should keep defaults when params omit title and message', () => {
    component.agInit({} as any);
    expect(component.title).toBe('Loading…');
    expect(component.message).toBe('Fetching data from qBittorrent');
  });

  it('refresh should update title and message and return true', () => {
    const result = component.refresh({ title: 'Updated Title', message: 'Updated Message' } as any);
    expect(component.title).toBe('Updated Title');
    expect(component.message).toBe('Updated Message');
    expect(result).toBe(true);
  });
});
