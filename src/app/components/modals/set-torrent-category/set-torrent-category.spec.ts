import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SetTorrentCategory } from './set-torrent-category';
import { Torrent } from '../../../models/torrent.model';

describe('SetTorrentCategory', () => {
  let component: SetTorrentCategory;
  let fixture: ComponentFixture<SetTorrentCategory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetTorrentCategory],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentCategory);
    component = fixture.componentInstance;
    component.torrent = { category: '' } as Torrent;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
