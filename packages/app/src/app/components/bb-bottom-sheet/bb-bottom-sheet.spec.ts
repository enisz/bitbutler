import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BbBottomSheet } from './bb-bottom-sheet';

@Component({
  template: `<app-bb-bottom-sheet [(open)]="open" title="More"
    ><p id="content">hello</p></app-bb-bottom-sheet
  >`,
  imports: [BbBottomSheet],
})
class HostComponent {
  open = signal(false);
}

describe('BbBottomSheet', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('renders nothing while closed', () => {
    const fixture = setup();
    expect(fixture.nativeElement.querySelector('.bb-sheet')).toBeNull();
  });

  it('renders the title and projected content while open', () => {
    const fixture = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bb-sheet__title').textContent).toContain('More');
    expect(fixture.nativeElement.querySelector('#content')).not.toBeNull();
  });

  it('closes when the backdrop is clicked', () => {
    const fixture = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('.bb-sheet__backdrop')).nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(fixture.nativeElement.querySelector('.bb-sheet')).toBeNull();
  });

  it('closes on Escape', () => {
    const fixture = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('does not close when the sheet body is clicked', () => {
    const fixture = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('.bb-sheet__panel')).nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(true);
  });
});
