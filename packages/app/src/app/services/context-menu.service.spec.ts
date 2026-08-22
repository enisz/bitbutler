import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ContextMenuService } from './context-menu.service';

describe('ContextMenuService', () => {
  let service: ContextMenuService;
  let mockOverlayRef: any;
  let mockOverlay: any;

  beforeEach(() => {
    mockOverlayRef = {
      attach: vi.fn().mockReturnValue({ instance: {} }),
      dispose: vi.fn(),
      hasAttached: vi.fn().mockReturnValue(false),
      backdropClick: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      keydownEvents: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    };

    mockOverlay = {
      create: vi.fn().mockReturnValue(mockOverlayRef),
      position: vi.fn().mockReturnValue({
        flexibleConnectedTo: vi.fn().mockReturnValue({
          withPositions: vi.fn().mockReturnThis(),
          withPush: vi.fn().mockReturnThis(),
          withViewportMargin: vi.fn().mockReturnThis(),
          withFlexibleDimensions: vi.fn().mockReturnThis(),
        }),
      }),
      scrollStrategies: {
        reposition: vi.fn().mockReturnValue({}),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        ContextMenuService,
        { provide: Overlay, useValue: mockOverlay },
        { provide: OverlayRef, useValue: mockOverlayRef },
        Injector,
      ],
    });

    service = TestBed.inject(ContextMenuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not throw on close() when no overlay is open', () => {
    expect(() => service.close()).not.toThrow();
  });

  it('should update lastMousePosition via openAt()', () => {
    const config = { items: [] } as any;
    service.openAt(100, 200, config);
    expect(mockOverlay.position).toHaveBeenCalled();
  });

  it('should close any existing overlay before opening a new one', () => {
    const config = { items: [] } as any;
    service.openAt(100, 200, config);
    service.openAt(300, 400, config);
    expect(mockOverlayRef.dispose).toHaveBeenCalled();
  });

  it('should call dispose on ngOnDestroy', () => {
    const config = { items: [] } as any;
    service.openAt(100, 200, config);
    service.ngOnDestroy();
    expect(mockOverlayRef.dispose).toHaveBeenCalled();
  });
});
