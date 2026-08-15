import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { BbCallout } from './bb-callout';

describe('BbCallout', () => {
  let component: BbCallout;
  let fixture: ComponentFixture<BbCallout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbCallout],
    }).compileComponents();

    fixture = TestBed.createComponent(BbCallout);
    component = fixture.componentInstance;
  });

  function setInputs(inputs: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
  }

  it('should create', () => {
    setInputs({ variant: 'info', message: 'hello' });
    expect(component).toBeTruthy();
  });

  it('applies the variant modifier class', () => {
    setInputs({ variant: 'warning', message: 'hello' });
    const el: HTMLElement = fixture.nativeElement.querySelector('.bb-callout');
    expect(el.classList.contains('bb-callout--warning')).toBe(true);
  });

  it('renders no icon when none is given', () => {
    setInputs({ variant: 'danger', message: 'hello' });
    expect(fixture.nativeElement.querySelector('fa-icon')).toBeNull();
  });

  it('renders the given icon', () => {
    setInputs({ variant: 'success', icon: faStar, message: 'hello' });
    expect(fixture.nativeElement.querySelector('fa-icon')).not.toBeNull();
  });

  it('renders the message next to the icon on a single line when there is no title', () => {
    setInputs({ variant: 'danger', message: 'This will free up 6.07 GB of disk space.' });
    const header: HTMLElement = fixture.nativeElement.querySelector('.bb-callout__header');
    const message = header.querySelector('.bb-callout__message');
    expect(message?.textContent?.trim()).toBe('This will free up 6.07 GB of disk space.');
    expect(fixture.nativeElement.querySelectorAll('.bb-callout__message').length).toBe(1);
  });

  it('renders a bold title next to the icon and the message on its own line below when title is given', () => {
    setInputs({ variant: 'warning', title: 'Keep in mind', message: 'Some details.' });
    const header: HTMLElement = fixture.nativeElement.querySelector('.bb-callout__header');
    const title = header.querySelector('.bb-callout__title');
    expect(title?.textContent?.trim()).toBe('Keep in mind');

    const messages = fixture.nativeElement.querySelectorAll('.bb-callout__message');
    expect(messages.length).toBe(1);
    expect(messages[0].textContent?.trim()).toBe('Some details.');
    expect(header.querySelector('.bb-callout__message')).toBeNull();
  });

  it('does not render a title element when title is an empty string', () => {
    setInputs({ variant: 'info', title: '', message: 'hello' });
    expect(fixture.nativeElement.querySelector('.bb-callout__title')).toBeNull();
  });
});
