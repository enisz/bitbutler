import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetTorrentLocation } from './set-torrent-location';

describe('SetTorrentLocation', () => {
  let component: SetTorrentLocation;
  let fixture: ComponentFixture<SetTorrentLocation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetTorrentLocation],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentLocation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
