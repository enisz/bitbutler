import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { SetTorrentTags } from './set-torrent-tags';

describe('SetTorrentTags', () => {
  let component: SetTorrentTags;
  let fixture: ComponentFixture<SetTorrentTags>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetTorrentTags],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentTags);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
