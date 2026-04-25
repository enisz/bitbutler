import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { AddTorrent } from './add-torrent';

describe('AddTorrent', () => {
  let component: AddTorrent;
  let fixture: ComponentFixture<AddTorrent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTorrent],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
