import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TorrentListGrid } from './torrent-list-grid';

describe('TorrentListGrid', () => {
  let component: TorrentListGrid;
  let fixture: ComponentFixture<TorrentListGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TorrentListGrid],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentListGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
