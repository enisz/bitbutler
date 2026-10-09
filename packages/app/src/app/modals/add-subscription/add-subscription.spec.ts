import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { RssStoreService } from '../../services/rss-store.service';
import { AddSubscription } from './add-subscription';

describe('AddSubscription', () => {
  let fixture: ComponentFixture<AddSubscription>;
  let component: AddSubscription;
  let store: { addFeed: ReturnType<typeof vi.fn> };
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = { addFeed: vi.fn().mockResolvedValue(true) };
    activeModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddSubscription],
      providers: [
        { provide: RssStoreService, useValue: store },
        { provide: NgbActiveModal, useValue: activeModal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddSubscription);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('cannot be saved without a valid http(s) url', () => {
    expect(component.canSave()).toBe(false);

    component.form.patchValue({ url: 'not a url' });
    expect(component.canSave()).toBe(false);

    component.form.patchValue({ url: 'https://example.com/rss.xml' });
    expect(component.canSave()).toBe(true);
  });

  it('rejects a name containing a backslash (qB path separator)', () => {
    component.form.patchValue({ url: 'https://example.com/rss.xml', name: 'a\\b' });
    expect(component.canSave()).toBe(false);
  });

  it('adds the feed and closes on success', async () => {
    component.form.patchValue({ url: 'https://example.com/rss.xml', name: 'Example' });

    await component.handleSubmit();

    expect(store.addFeed).toHaveBeenCalledWith('https://example.com/rss.xml', 'Example');
    expect(activeModal.close).toHaveBeenCalledWith(true);
  });

  it('stays open when the store reports a failure', async () => {
    store.addFeed.mockResolvedValue(false);
    component.form.patchValue({ url: 'https://example.com/rss.xml' });

    await component.handleSubmit();

    expect(activeModal.close).not.toHaveBeenCalled();
    expect(component.processing()).toBe(false);
  });

  it('does nothing when the form is invalid', async () => {
    await component.handleSubmit();
    expect(store.addFeed).not.toHaveBeenCalled();
  });
});
