import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faCircle,
  faCloudDownloadAlt,
  faCloudUploadAlt,
  faDownload,
  faHdd,
  faNetworkWired,
  faPlay,
  faShareAlt,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';

@Component({
  selector: 'app-status-bar-widget-preview',
  standalone: true,
  imports: [FaIconComponent, NgbTooltipModule, FilesizePipe, TranslatePipe],
  templateUrl: './widget-preview.html',
  styleUrl: './widget-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBarWidgetPreview {
  public readonly id = input.required<string>();

  public faCircle = faCircle;
  public faNetworkWired = faNetworkWired;
  public faShareAlt = faShareAlt;
  public faCloudDownloadAlt = faCloudDownloadAlt;
  public faCloudUploadAlt = faCloudUploadAlt;
  public faDownload = faDownload;
  public faUpload = faUpload;
  public faHdd = faHdd;
  public faPlay = faPlay;

  // Sample values shown here - not backed by live server data.
  public readonly PREVIEW_DHT_NODES = 42;
  public readonly PREVIEW_SESSION_RATIO = '1.25';
  public readonly PREVIEW_ALLTIME_RATIO = '3.42';
  public readonly PREVIEW_GLOBAL_DOWN = 512_000_000;
  public readonly PREVIEW_ALLTIME_DOWN = 128_500_000_000;
  public readonly PREVIEW_GLOBAL_UP = 256_000_000;
  public readonly PREVIEW_ALLTIME_UP = 64_200_000_000;
  public readonly PREVIEW_DL_SPEED = 4_500_000;
  public readonly PREVIEW_UP_SPEED = 1_200_000;
  public readonly PREVIEW_FREE_SPACE = 850_000_000_000;
  public readonly PREVIEW_SELECTED_COUNT = 3;
  public readonly PREVIEW_FILTERED_COUNT = 128;
  public readonly PREVIEW_POLL_PROGRESS = 65;
}
