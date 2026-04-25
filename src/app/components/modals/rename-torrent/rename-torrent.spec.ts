import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { RenameTorrent } from './rename-torrent';
import { Torrent } from '../../../models/torrent.model';

describe('RenameTorrent', () => {
  let component: RenameTorrent;
  let fixture: ComponentFixture<RenameTorrent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RenameTorrent],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(RenameTorrent);
    component = fixture.componentInstance;
    component.torrent = { name: 'test-torrent' } as Torrent;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
