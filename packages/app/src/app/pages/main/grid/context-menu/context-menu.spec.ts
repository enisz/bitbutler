import { OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { ContextMenu } from './context-menu';
import { CONTEXT_MENU_CONFIG } from './context-menu.tokens';
import type { ContextMenuEntry } from './context-menu.types';

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
      expect(action).not.toHaveBeenCalled();
    });
  });

  describe('tooltip popover', () => {
    let showPopoverSpy: ReturnType<typeof vi.spyOn>;
    let hidePopoverSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      showPopoverSpy = vi.spyOn(HTMLElement.prototype, 'showPopover').mockImplementation(() => {});
      hidePopoverSpy = vi.spyOn(HTMLElement.prototype, 'hidePopover').mockImplementation(() => {});
    });

    afterEach(() => {
      showPopoverSpy.mockRestore();
      hidePopoverSpy.mockRestore();
    });

    function makeTarget(): HTMLElement {
      const el = document.createElement('button');
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        top: 10,
        left: 20,
        right: 80,
        bottom: 30,
        width: 60,
        height: 20,
        x: 20,
        y: 10,
        toJSON: () => ({}),
      } as DOMRect);
      return el;
    }

    it('shows the popover with the tooltip text for a disabled item with a tooltip', () => {
      const entry: ContextMenuEntry = {
        kind: 'item',
        id: 'x',
        label: 'X',
        disabled: true,
        tooltip: 'Not available right now',
      };
      component.onItemMouseEnter(entry, makeTarget());
      expect(component.tooltipText()).toBe('Not available right now');
      expect(showPopoverSpy).toHaveBeenCalled();
    });

    it('does nothing for an enabled item even if it has a tooltip', () => {
      const entry: ContextMenuEntry = {
        kind: 'item',
        id: 'x',
        label: 'X',
        disabled: false,
        tooltip: 'Should not show',
      };
      component.onItemMouseEnter(entry, makeTarget());
      expect(component.tooltipText()).toBeNull();
      expect(showPopoverSpy).not.toHaveBeenCalled();
    });

    it('does nothing for a disabled item with no tooltip text', () => {
      const entry: ContextMenuEntry = { kind: 'item', id: 'x', label: 'X', disabled: true };
      component.onItemMouseEnter(entry, makeTarget());
      expect(component.tooltipText()).toBeNull();
      expect(showPopoverSpy).not.toHaveBeenCalled();
    });

    it('hides the popover and clears the text on mouse leave', () => {
      const entry: ContextMenuEntry = {
        kind: 'item',
        id: 'x',
        label: 'X',
        disabled: true,
        tooltip: 'Hint',
      };
      component.onItemMouseEnter(entry, makeTarget());
      component.onItemMouseLeave();
      expect(component.tooltipText()).toBeNull();
      expect(hidePopoverSpy).toHaveBeenCalled();
    });
  });
});
