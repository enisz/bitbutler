import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { TorrentDetails } from './torrent-details';

describe('TorrentDetails', () => {
  let component: TorrentDetails;
  let fixture: ComponentFixture<TorrentDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TorrentDetails],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
