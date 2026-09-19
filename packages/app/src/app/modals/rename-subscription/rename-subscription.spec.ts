import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { RssFeed } from '../../models/rss.model';
import { RssStoreService } from '../../services/rss-store.service';
import { RenameSubscription } from './rename-subscription';

const FEED: RssFeed = {
  path: 'Folder\\Old',
  name: 'Old',
  url: 'https://a/rss',
  isLoading: false,
  hasError: false,
};

describe('RenameSubscription', () => {
  let fixture: ComponentFixture<RenameSubscription>;
  let component: RenameSubscription;
  let store: { renameFeed: ReturnType<typeof vi.fn> };
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = { renameFeed: vi.fn().mockResolvedValue(true) };
    activeModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RenameSubscription],
      providers: [
        { provide: RssStoreService, useValue: store },
        { provide: NgbActiveModal, useValue: activeModal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RenameSubscription);
    fixture.componentRef.setInput('feed', FEED);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('prefills the current name and cannot save it unchanged', () => {
    expect(component.form.controls.name.value).toBe('Old');
    expect(component.canSave()).toBe(false);
  });

  it('rejects blank names and names containing a backslash', () => {
    component.form.controls.name.setValue('   ');
    expect(component.canSave()).toBe(false);

    component.form.controls.name.setValue('a\\b');
    expect(component.canSave()).toBe(false);
  });

  it('renames and closes on success', async () => {
    component.form.controls.name.setValue('New name');

    await component.handleSubmit();

    expect(store.renameFeed).toHaveBeenCalledWith(FEED, 'New name');
    expect(activeModal.close).toHaveBeenCalledWith(true);
  });

  it('stays open when the store reports a failure', async () => {
    store.renameFeed.mockResolvedValue(false);
    component.form.controls.name.setValue('New name');

    await component.handleSubmit();

    expect(activeModal.close).not.toHaveBeenCalled();
  });
});
