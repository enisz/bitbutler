import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RenameTorrent } from './rename-torrent';

describe('RenameTorrent', () => {
  let component: RenameTorrent;
  let fixture: ComponentFixture<RenameTorrent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RenameTorrent],
    }).compileComponents();

    fixture = TestBed.createComponent(RenameTorrent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
