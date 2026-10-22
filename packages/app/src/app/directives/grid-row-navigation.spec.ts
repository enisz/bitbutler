import { ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgGridAngular } from 'ag-grid-angular';
import { Subject } from 'rxjs';
import { GridRowNavigationDirective } from './grid-row-navigation';

interface FakeNode {
  rowIndex: number;
  selectable: boolean;
  rowHeight: number;
  selected: boolean;
  setSelected: ReturnType<typeof vi.fn>;
}

type Listener = (event: unknown) => void;

describe('GridRowNavigationDirective', () => {
  let element: HTMLElement;
  let nodes: FakeNode[];
  let listeners: Record<string, Listener>;
  let rowSelection: unknown;
  let pagination: boolean;
  let pageSize: number;
  let currentPage: number;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let gridReady: Subject<{ api: unknown }>;
  let directive: GridRowNavigationDirective;

  const createNodes = (count: number, selectable = (_i: number) => true) =>
    Array.from({ length: count }, (_, rowIndex): FakeNode => {
      const node: FakeNode = {
        rowIndex,
        selectable: selectable(rowIndex),
        rowHeight: 32,
        selected: false,
        setSelected: vi.fn((value: boolean, clear?: boolean) => {
          if (clear) nodes.forEach((n) => (n.selected = false));
          node.selected = value;
        }),
      };
      return node;
    });

  const selectedIndexes = () => nodes.filter((n) => n.selected).map((n) => n.rowIndex);

  const press = (code: string, init: KeyboardEventInit = {}, target: HTMLElement = element) => {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  const select = (...indexes: number[]) => {
    nodes.forEach((n) => (n.selected = indexes.includes(n.rowIndex)));
  };

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);

    nodes = createNodes(100);
    listeners = {};
    rowSelection = { mode: 'multiRow', enableClickSelection: true };
    pagination = false;
    pageSize = 50;
    currentPage = 0;
    gridReady = new Subject();

    api = {
      addEventListener: vi.fn((name: string, fn: Listener) => (listeners[name] = fn)),
      getGridOption: vi.fn((name: string) => {
        if (name === 'rowSelection') return rowSelection;
        if (name === 'pagination') return pagination;
        return undefined;
      }),
      getSelectedNodes: vi.fn(() => nodes.filter((n) => n.selected)),
      getDisplayedRowCount: vi.fn(() => nodes.length),
      getDisplayedRowAtIndex: vi.fn((i: number) => nodes[i]),
      getAllDisplayedColumns: vi.fn(() => [{ getColId: () => 'name' }]),
      deselectAll: vi.fn(() => nodes.forEach((n) => (n.selected = false))),
      setFocusedCell: vi.fn(),
      ensureIndexVisible: vi.fn(),
      paginationGetPageSize: vi.fn(() => pageSize),
      paginationGetCurrentPage: vi.fn(() => currentPage),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AgGridAngular, useValue: { gridReady } },
        { provide: ElementRef, useValue: new ElementRef(element) },
      ],
    });
    const injector = TestBed.inject(Injector);
    directive = runInInjectionContext(injector, () => new GridRowNavigationDirective());

    gridReady.next({ api });
    // Make this grid the active one, as a click inside it would.
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });

  afterEach(() => {
    element.remove();
    document.querySelectorAll('ngb-modal-window').forEach((m) => m.remove());
  });

  describe('arrow keys', () => {
    it('moves the selection down and up from the lead row', () => {
      select(5);
      directive.leadIndex = 5;

      press('ArrowDown');
      expect(selectedIndexes()).toEqual([6]);
      press('ArrowUp');
      press('ArrowUp');
      expect(selectedIndexes()).toEqual([4]);
    });

    it('starts from the last selected row when there is no lead row yet', () => {
      select(10);

      press('ArrowDown');

      expect(selectedIndexes()).toEqual([11]);
    });

    describe('when nothing is selected', () => {
      it.each([
        ['ArrowDown', 0],
        ['PageDown', 0],
        ['Home', 0],
        ['ArrowUp', 99],
        ['PageUp', 99],
        ['End', 99],
      ])('%s selects row %i', (code, expected) => {
        const event = press(code);

        expect(selectedIndexes()).toEqual([expected]);
        expect(directive.leadIndex).toBe(expected);
        expect(directive.anchorIndex).toBe(expected);
        expect(event.defaultPrevented).toBe(true);
        expect(api['ensureIndexVisible']).toHaveBeenCalledWith(expected);
      });

      it('selects a single row with Shift as well', () => {
        press('ArrowDown', { shiftKey: true });

        expect(selectedIndexes()).toEqual([0]);
      });

      it('skips rows that cannot be selected', () => {
        nodes = createNodes(10, (i) => i !== 0 && i !== 9);

        press('ArrowDown');
        expect(selectedIndexes()).toEqual([1]);

        nodes.forEach((n) => (n.selected = false));
        directive.leadIndex = null;
        press('ArrowUp');
        expect(selectedIndexes()).toEqual([8]);
      });

      it('starts over when the previous selection was cleared', () => {
        directive.leadIndex = 40;
        directive.anchorIndex = 40;

        press('ArrowDown');

        expect(selectedIndexes()).toEqual([0]);
      });

      it('does nothing when no row can be selected', () => {
        nodes = createNodes(3, () => false);

        const event = press('ArrowDown');

        expect(selectedIndexes()).toEqual([]);
        expect(event.defaultPrevented).toBe(false);
      });

      it('does nothing when the grid has no rows', () => {
        nodes = [];

        expect(press('ArrowDown').defaultPrevented).toBe(false);
      });
    });

    it('stays on the first and last row at the edges', () => {
      select(0);
      directive.leadIndex = 0;
      expect(press('ArrowUp').defaultPrevented).toBe(false);

      select(99);
      directive.leadIndex = 99;
      expect(press('ArrowDown').defaultPrevented).toBe(false);
      expect(selectedIndexes()).toEqual([99]);
    });

    it('prevents the default scrolling and scrolls the new row into view', () => {
      select(5);
      directive.leadIndex = 5;

      const event = press('ArrowDown');

      expect(event.defaultPrevented).toBe(true);
      expect(api['ensureIndexVisible']).toHaveBeenCalledWith(6);
      expect(api['setFocusedCell']).toHaveBeenCalledWith(6, 'name');
    });

    it('extends the selection from the anchor with Shift', () => {
      select(5);
      directive.anchorIndex = 5;
      directive.leadIndex = 5;

      press('ArrowDown', { shiftKey: true });
      press('ArrowDown', { shiftKey: true });
      expect(selectedIndexes()).toEqual([5, 6, 7]);

      press('ArrowUp', { shiftKey: true });
      expect(selectedIndexes()).toEqual([5, 6]);
    });

    it('keeps the existing selection when Ctrl and Shift are held', () => {
      select(1, 5);
      directive.anchorIndex = 5;
      directive.leadIndex = 5;

      press('ArrowDown', { shiftKey: true, ctrlKey: true });

      expect(selectedIndexes()).toEqual([1, 5, 6]);
    });

    it.each(['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'])(
      'leaves Ctrl+%s alone',
      (code) => {
        select(5);
        directive.leadIndex = 5;

        const event = press(code, { ctrlKey: true });

        expect(selectedIndexes()).toEqual([5]);
        expect(event.defaultPrevented).toBe(false);
        expect(api['ensureIndexVisible']).not.toHaveBeenCalled();
      },
    );
  });

  describe('Home, End and paging', () => {
    it('jumps to the first and last row', () => {
      select(40);
      directive.leadIndex = 40;

      press('End');
      expect(selectedIndexes()).toEqual([99]);
      press('Home');
      expect(selectedIndexes()).toEqual([0]);
    });

    it('selects a range with Shift+End', () => {
      select(97);
      directive.anchorIndex = 97;
      directive.leadIndex = 97;

      press('End', { shiftKey: true });

      expect(selectedIndexes()).toEqual([97, 98, 99]);
    });

    it('pages by the viewport height and row height', () => {
      const viewport = document.createElement('div');
      viewport.className = 'ag-body-vertical-scroll-viewport';
      Object.defineProperty(viewport, 'clientHeight', { value: 320 });
      element.appendChild(viewport);
      select(0);
      directive.leadIndex = 0;

      press('PageDown');
      // 320 / 32 = 10 rows per page, minus one for overlap.
      expect(selectedIndexes()).toEqual([9]);
      press('PageUp');
      expect(selectedIndexes()).toEqual([0]);
    });

    it('clamps a page jump at the last row', () => {
      select(98);
      directive.leadIndex = 98;

      press('PageDown');

      expect(selectedIndexes()).toEqual([99]);
    });
  });

  describe('rows that cannot be selected', () => {
    beforeEach(() => {
      nodes = createNodes(10, (i) => i % 3 !== 0 || i === 0);
      // selectable: 0, 1, 2, 4, 5, 7, 8 (3, 6, 9 are not)
      nodes[0].selectable = true;
    });

    it('skips them with the arrow keys', () => {
      select(2);
      directive.leadIndex = 2;

      press('ArrowDown');
      expect(selectedIndexes()).toEqual([4]);
      press('ArrowUp');
      expect(selectedIndexes()).toEqual([2]);
    });

    it('lands on the last selectable row with End', () => {
      select(0);
      directive.leadIndex = 0;

      press('End');

      expect(selectedIndexes()).toEqual([8]);
    });

    it('does not select them in a Shift range', () => {
      select(2);
      directive.anchorIndex = 2;
      directive.leadIndex = 2;

      press('ArrowDown', { shiftKey: true });
      press('ArrowDown', { shiftKey: true });

      expect(selectedIndexes()).toEqual([2, 4, 5]);
    });

    it('stays put when there is no selectable row left in that direction', () => {
      nodes[9].selectable = false;
      select(8);
      directive.leadIndex = 8;

      expect(press('ArrowDown').defaultPrevented).toBe(false);
    });
  });

  describe('Ctrl+A', () => {
    it('selects every displayed row without a pager', () => {
      press('KeyA', { ctrlKey: true });

      expect(selectedIndexes()).toHaveLength(100);
    });

    it('selects only the rows on the current page', () => {
      pagination = true;
      currentPage = 1;

      press('KeyA', { ctrlKey: true });

      expect(selectedIndexes()).toEqual(Array.from({ length: 50 }, (_, i) => 50 + i));
    });

    it('selects only the remaining rows on a partial last page', () => {
      nodes = createNodes(120);
      pagination = true;
      currentPage = 2;

      press('KeyA', { ctrlKey: true });

      expect(selectedIndexes()).toEqual(Array.from({ length: 20 }, (_, i) => 100 + i));
    });

    it('replaces a previous selection and skips unselectable rows', () => {
      nodes = createNodes(10, (i) => i !== 4);
      select(4);

      press('KeyA', { ctrlKey: true });

      expect(selectedIndexes()).toEqual([0, 1, 2, 3, 5, 6, 7, 8, 9]);
    });

    it('also works with the meta key', () => {
      press('KeyA', { metaKey: true });

      expect(selectedIndexes()).toHaveLength(100);
    });

    it('prevents the browser select-all', () => {
      expect(press('KeyA', { ctrlKey: true }).defaultPrevented).toBe(true);
    });
  });

  describe('Delete key', () => {
    let deleted: () => void;

    const release = (code: string, init: KeyboardEventInit = {}, target: HTMLElement = element) => {
      target.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, ...init }));
    };

    beforeEach(() => {
      deleted = vi.fn();
      directive.gridDelete.subscribe(deleted);
      select(5);
    });

    it('emits when Delete is released with a selection', () => {
      release('Delete');

      expect(deleted).toHaveBeenCalledTimes(1);
    });

    it('does not emit without a selection', () => {
      select();

      release('Delete');

      expect(deleted).not.toHaveBeenCalled();
    });

    it('does not emit on key down, so holding the key does not repeat it', () => {
      press('Delete');

      expect(deleted).not.toHaveBeenCalled();
    });

    it.each([{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }])(
      'ignores Delete combined with %o',
      (init) => {
        release('Delete', init);

        expect(deleted).not.toHaveBeenCalled();
      },
    );

    it('ignores Delete while typing in an input', () => {
      const input = document.createElement('input');
      element.appendChild(input);

      release('Delete', {}, input);

      expect(deleted).not.toHaveBeenCalled();
    });

    it('ignores Delete when another grid was clicked last', () => {
      const otherGrid = document.createElement('ag-grid-angular');
      document.body.appendChild(otherGrid);
      otherGrid.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      release('Delete');

      expect(deleted).not.toHaveBeenCalled();
      otherGrid.remove();
    });

    it('ignores Delete when a modal is open and the grid is not inside it', () => {
      document.body.appendChild(document.createElement('ngb-modal-window'));

      release('Delete');

      expect(deleted).not.toHaveBeenCalled();
    });

    it('ignores Delete for grids that are not in multi-row selection mode', () => {
      rowSelection = undefined;

      release('Delete');

      expect(deleted).not.toHaveBeenCalled();
    });
  });

  describe('when the grid must not react', () => {
    beforeEach(() => {
      select(5);
      directive.leadIndex = 5;
    });

    it('ignores keys while typing in an input', () => {
      const input = document.createElement('input');
      element.appendChild(input);

      press('ArrowDown', {}, input);
      press('KeyA', { ctrlKey: true }, input);

      expect(selectedIndexes()).toEqual([5]);
    });

    it.each(['.ag-popup', '[role="menu"]', '[role="listbox"]', '[role="tablist"]'])(
      'ignores keys inside %s',
      (selector) => {
        const container = document.createElement('div');
        if (selector.startsWith('.')) container.className = selector.slice(1);
        else container.setAttribute('role', selector.slice(7, -2));
        const item = document.createElement('button');
        container.appendChild(item);
        document.body.appendChild(container);

        press('ArrowDown', {}, item);

        expect(selectedIndexes()).toEqual([5]);
        container.remove();
      },
    );

    it('keeps reacting after a click outside of any grid', () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      press('ArrowDown');

      expect(selectedIndexes()).toEqual([6]);
    });

    it('stops reacting once another grid was clicked', () => {
      const otherGrid = document.createElement('ag-grid-angular');
      const cell = document.createElement('div');
      otherGrid.appendChild(cell);
      document.body.appendChild(otherGrid);

      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      press('ArrowDown');

      expect(selectedIndexes()).toEqual([5]);
      otherGrid.remove();
    });

    it('ignores keys when a modal is open and the grid is not inside it', () => {
      document.body.appendChild(document.createElement('ngb-modal-window'));

      press('ArrowDown');

      expect(selectedIndexes()).toEqual([5]);
    });

    it('reacts when the grid is inside the topmost modal', () => {
      const modal = document.createElement('ngb-modal-window');
      document.body.appendChild(modal);
      modal.appendChild(element);
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      press('ArrowDown');

      expect(selectedIndexes()).toEqual([6]);
    });

    describe('before the grid was ever clicked', () => {
      beforeEach(() => {
        TestBed.resetTestingModule();
        element.remove();
        element = document.createElement('div');
        document.body.appendChild(element);
        TestBed.configureTestingModule({
          providers: [
            { provide: AgGridAngular, useValue: { gridReady } },
            { provide: ElementRef, useValue: new ElementRef(element) },
          ],
        });
        directive = runInInjectionContext(
          TestBed.inject(Injector),
          () => new GridRowNavigationDirective(),
        );
        gridReady.next({ api });
        select(5);
        directive.leadIndex = 5;
      });

      it('ignores a grid on the page', () => {
        press('ArrowDown');

        expect(selectedIndexes()).toEqual([5]);
      });

      it('reacts in a grid inside the topmost modal', () => {
        const modal = document.createElement('ngb-modal-window');
        document.body.appendChild(modal);
        modal.appendChild(element);

        press('ArrowDown');

        expect(selectedIndexes()).toEqual([6]);
      });
    });

    it('ignores grids that are not in multi-row selection mode', () => {
      rowSelection = undefined;

      press('ArrowDown');

      expect(selectedIndexes()).toEqual([5]);
    });

    it('ignores keys combined with Alt', () => {
      press('ArrowDown', { altKey: true });

      expect(selectedIndexes()).toEqual([5]);
    });

    it('stops reacting once destroyed', () => {
      TestBed.resetTestingModule();

      press('ArrowDown');

      expect(selectedIndexes()).toEqual([5]);
    });
  });

  describe('mouse tracking', () => {
    const click = (rowIndex: number, shiftKey = false, ctrlKey = false) => {
      const event = { rowIndex, node: nodes[rowIndex], event: { shiftKey, ctrlKey } };
      listeners['rowClicked'](event);
      listeners['cellClicked'](event);
    };

    it('moves the anchor and lead row to the clicked row', () => {
      click(12);

      expect(directive.anchorIndex).toBe(12);
      expect(directive.leadIndex).toBe(12);
    });

    it('keeps the anchor on a Shift click and selects the range', () => {
      click(10);
      select(10);

      click(13, true);

      expect(directive.anchorIndex).toBe(10);
      expect(selectedIndexes()).toEqual([10, 11, 12, 13]);
    });

    it('does not select a range on Shift click when click selection is disabled', () => {
      rowSelection = { mode: 'multiRow', enableClickSelection: false };
      click(10);
      select(10);

      click(13, true);

      expect(selectedIndexes()).toEqual([10]);
    });

    describe('clicking a row that cannot be selected', () => {
      beforeEach(() => {
        nodes[5].selectable = false;
        click(2);
        select(2);
      });

      it('clears the selection and the anchor and lead rows', () => {
        click(5);

        expect(selectedIndexes()).toEqual([]);
        expect(directive.anchorIndex).toBeNull();
        expect(directive.leadIndex).toBeNull();
      });

      it('keeps the selection on a Ctrl click', () => {
        click(5, false, true);

        expect(selectedIndexes()).toEqual([2]);
        expect(directive.leadIndex).toBe(2);
      });

      it('keeps the selection on a Shift click', () => {
        click(5, true);

        expect(selectedIndexes()).toContain(2);
        expect(directive.anchorIndex).toBe(2);
      });

      it('keeps the selection when click selection is disabled', () => {
        rowSelection = { mode: 'multiRow', enableClickSelection: false };

        click(5);

        expect(selectedIndexes()).toEqual([2]);
      });

      it('lets the arrow keys start from an empty selection afterwards', () => {
        click(5);

        press('ArrowDown');

        expect(selectedIndexes()).toEqual([0]);
      });
    });

    it('follows the last checkbox toggled', () => {
      select(3, 8);

      listeners['selectionChanged']({ source: 'checkboxSelected' });

      expect(directive.anchorIndex).toBe(8);
      expect(directive.leadIndex).toBe(8);
    });

    it('ignores selection changes that did not come from a checkbox', () => {
      directive.leadIndex = 2;
      select(8);

      listeners['selectionChanged']({ source: 'api' });

      expect(directive.leadIndex).toBe(2);
    });
  });
});
