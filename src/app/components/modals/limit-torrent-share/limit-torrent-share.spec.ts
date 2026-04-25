import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { LimitTorrentShare } from './limit-torrent-share';

describe('LimitTorrentShare', () => {
  let component: LimitTorrentShare;
  let fixture: ComponentFixture<LimitTorrentShare>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LimitTorrentShare],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(LimitTorrentShare);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
