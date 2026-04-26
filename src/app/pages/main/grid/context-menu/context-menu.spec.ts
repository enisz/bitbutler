import { OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenu } from './context-menu';
import { CONTEXT_MENU_CONFIG } from './context-menu.tokens';
import type { ContextMenuEntry } from './context-menu.types';
import { EMPTY } from 'rxjs';

function makeOverlayRefMock() {
  return {
    dispose: vi.fn(),
    detach: vi.fn(),
    detachments: () => EMPTY,
  };
}

describe('ContextMenu', () => {
  let component: ContextMenu;
  let fixture: ComponentFixture<ContextMenu>;
  let overlayRefMock: ReturnType<typeof makeOverlayRefMock>;

  const items: ContextMenuEntry[] = [
    { kind: 'item', id: 'action1', label: 'Action 1', action: vi.fn() },
    { kind: 'divider' },
    { kind: 'header', label: 'Section' },
    { kind: 'submenu', id: 'sub1', label: 'Submenu', children: [] },
  ];

  beforeEach(async () => {
    overlayRefMock = makeOverlayRefMock();

    await TestBed.configureTestingModule({
      imports: [ContextMenu, OverlayModule],
      providers: [
        { provide: OverlayRef, useValue: overlayRefMock },
        { provide: CONTEXT_MENU_CONFIG, useValue: { items } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose items from config', () => {
    expect(component.items).toBe(items);
  });

  it('close should call overlayRef.dispose', () => {
    component.close();
    expect(overlayRefMock.dispose).toHaveBeenCalled();
  });

  describe('trackBy', () => {
    it('should return item key for item entries', () => {
      expect(component.trackBy(0, { kind: 'item', id: 'foo', label: 'Foo' } as any)).toBe(
        'item:foo',
      );
    });

    it('should return submenu key for submenu entries', () => {
      expect(
        component.trackBy(0, { kind: 'submenu', id: 'bar', label: 'Bar', children: [] } as any),
      ).toBe('submenu:bar');
    });

    it('should return header key for header entries', () => {
      expect(component.trackBy(0, { kind: 'header', label: 'My Header' } as any)).toBe(
        'header:My Header',
      );
    });

    it('should return divider key using index for divider entries', () => {
      expect(component.trackBy(5, { kind: 'divider' } as any)).toBe('divider:5');
    });
  });

  describe('onEntryClick', () => {
    it('should call action function for enabled items', () => {
      const action = vi.fn();
      component.onEntryClick({ kind: 'item', id: 'test', label: 'Test', action } as any);
      expect(action).toHaveBeenCalled();
    });

    it('should not call action for disabled items', () => {
      const action = vi.fn();
      component.onEntryClick({
        kind: 'item',
        id: 'test',
        label: 'Test',
        disabled: true,
        action,
      } as any);
      expect(action).not.toHaveBeenCalled();
    });

    it('should not call action for non-item entries', () => {
      const action = vi.fn();
      component.onEntryClick({ kind: 'divider' } as any);
      // no error thrown, no action called
      expect(action).not.toHaveBeenCalled();
    });
  });
});
