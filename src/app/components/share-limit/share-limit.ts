import { Component } from '@angular/core';

export type ShareLimitValue = {
  ratioLimit: number | null;
  seedingTimeLimit: number | null;
  inactiveSeedingTimeLimit: number | null;
};

@Component({
  selector: 'app-share-limit',
  imports: [],
  templateUrl: './share-limit.html',
  styleUrl: './share-limit.scss',
})
export class ShareLimit {}
