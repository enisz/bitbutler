import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { SetTorrentLocation } from './set-torrent-location';

describe('SetTorrentLocation', () => {
  let component: SetTorrentLocation;
  let fixture: ComponentFixture<SetTorrentLocation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetTorrentLocation],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentLocation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
