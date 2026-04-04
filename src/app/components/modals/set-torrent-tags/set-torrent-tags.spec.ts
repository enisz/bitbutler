import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetTorrentTags } from './set-torrent-tags';

describe('SetTorrentTags', () => {
  let component: SetTorrentTags;
  let fixture: ComponentFixture<SetTorrentTags>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetTorrentTags],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentTags);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
