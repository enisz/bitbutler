import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { faBell, faGear } from '@fortawesome/free-solid-svg-icons';
import { ElectronService } from '../../services/electron.service';
import { SettingsShell } from './settings-shell';
import { SettingsPageConfig } from './settings-shell.model';

let created = 0;

@Component({
  selector: 'app-test-pane',
  template: 'pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPane {
  constructor() {
    created++;
  }
}

const config: SettingsPageConfig = {
  basePath: '/pages/test',
  titleKey: 'test.title',
  footerNoteKey: 'test.footer',
  groups: [
    {
      labelKey: 'test.group.one',
      panes: [
        {
          id: 'one',
          labelKey: 'test.pane.one',
          descriptionKey: 'test.pane.one.description',
          icon: faGear,
          formId: 'form-a',
          loadComponent: () => Promise.resolve(TestPane),
        },
        {
          id: 'two',
          labelKey: 'test.pane.two',
          descriptionKey: 'test.pane.two.description',
          icon: faBell,
          formId: 'form-b',
          loadComponent: () => Promise.resolve(TestPane),
        },
      ],
    },
  ],
};

describe('SettingsShell', () => {
  let fixture: ComponentFixture<SettingsShell>;

  const root = () => fixture.nativeElement as HTMLElement;
  const query = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const queryAll = (selector: string) => Array.from(root().querySelectorAll(selector));

  // Panes are loaded through plain promises, which whenStable does not wait for.
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };

  const setInputs = async (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await settle();
  };

  beforeEach(async () => {
    created = 0;

    await TestBed.configureTestingModule({
      imports: [SettingsShell],
      providers: [
        provideRouter([]),
        { provide: ElectronService, useValue: { getBitButlerVersion: () => '1.2.3' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsShell);
    fixture.componentRef.setInput('config', config);
    fixture.componentRef.setInput('activePaneId', 'one');
    fixture.detectChanges();
    await settle();
  });

  it('renders the title, group label, nav items and version', () => {
    expect(root().textContent).toContain('test.title');
    expect(root().textContent).toContain('test.group.one');
    expect(queryAll('.bb-settings__nav-item')).toHaveLength(2);
    expect(root().textContent).toContain('v1.2.3');
  });

  it('marks the active pane in the nav and shows its title and description', () => {
    const items = queryAll('.bb-settings__nav-item');
    expect(items[0].classList.contains('active')).toBe(true);
    expect(items[1].classList.contains('active')).toBe(false);
    expect(query('.bb-settings__pane-title')?.textContent).toContain('test.pane.one');
    expect(query('.bb-settings__pane-description')?.textContent).toContain(
      'test.pane.one.description',
    );
  });

  it('shows an unsaved marker only on nav items whose form is dirty', async () => {
    await setInputs({ dirtyMap: { 'form-a': false, 'form-b': true } });

    const dots = queryAll('.bb-settings__dirty-dot');
    expect(dots).toHaveLength(1);
    expect(dots[0].closest('.bb-settings__nav-item')).toBe(queryAll('.bb-settings__nav-item')[1]);
  });

  it('lets paneDirtyMap override the form flag for a single pane', async () => {
    await setInputs({
      dirtyMap: { 'form-a': true, 'form-b': true },
      paneDirtyMap: { one: true, two: false },
    });

    const dots = queryAll('.bb-settings__dirty-dot');
    expect(dots).toHaveLength(1);
    expect(dots[0].closest('.bb-settings__nav-item')).toBe(queryAll('.bb-settings__nav-item')[0]);
  });

  it('disables Save and Discard while clean', () => {
    expect(query<HTMLButtonElement>('.bb-settings__save')?.disabled).toBe(true);
    expect(query<HTMLButtonElement>('.bb-settings__discard')?.disabled).toBe(true);
  });

  it('puts Cancel last in the footer, like the dialogs', () => {
    const buttons = queryAll('.bb-settings__actions button');

    expect(buttons.map((button) => button.className.includes('bb-settings__save'))).toEqual([
      true,
      false,
    ]);
    expect(buttons[1].classList).toContain('bb-settings__discard');
  });

  it('enables Save and Discard while dirty, and emits their events', async () => {
    await setInputs({ isDirty: true });
    const saved = vi.fn();
    const discarded = vi.fn();
    fixture.componentInstance.save.subscribe(saved);
    fixture.componentInstance.discard.subscribe(discarded);

    query<HTMLButtonElement>('.bb-settings__save')?.click();
    query<HTMLButtonElement>('.bb-settings__discard')?.click();

    expect(saved).toHaveBeenCalledOnce();
    expect(discarded).toHaveBeenCalledOnce();
  });

  it('emits back from the back button', () => {
    const back = vi.fn();
    fixture.componentInstance.back.subscribe(back);

    query<HTMLButtonElement>('.bb-settings__back')?.click();

    expect(back).toHaveBeenCalledOnce();
  });

  it('mounts every pane but shows only the active one', () => {
    const panes = queryAll('.bb-settings__pane');
    expect(panes).toHaveLength(2);
    expect(panes.filter((pane) => !pane.classList.contains('d-none'))).toHaveLength(1);
  });

  it('keeps panes mounted when the active pane changes', async () => {
    expect(created).toBe(2);

    await setInputs({ activePaneId: 'two' });

    expect(created).toBe(2);
    expect(query('.bb-settings__pane-title')?.textContent).toContain('test.pane.two');
  });

  it('rebuilds the panes when the pane version changes', async () => {
    await setInputs({ paneVersion: 1 });

    expect(created).toBe(4);
  });

  it('shows a spinner instead of panes while loading', async () => {
    await setInputs({ status: 'loading' });

    expect(query('app-bb-spinner')).not.toBeNull();
    expect(queryAll('.bb-settings__pane')).toHaveLength(0);
  });

  it('shows the error message with a Retry button that emits retry', async () => {
    await setInputs({ status: 'error', errorKey: 'test.error' });
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    expect(root().textContent).toContain('test.error');
    query<HTMLButtonElement>('.bb-settings__retry')?.click();

    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows the subtitle when one is given', async () => {
    await setInputs({ subtitle: 'My Server' });

    expect(query('.bb-settings__subtitle')?.textContent).toContain('My Server');
  });
});
