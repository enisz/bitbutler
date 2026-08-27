import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleInfo, faList, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { CommandBusService } from '../../../services/command-bus.service';

@Component({
  selector: 'app-nav-rail',
  imports: [RouterLink, RouterLinkActive, FontAwesomeModule, NgbTooltip, TranslatePipe],
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavRail {
  private readonly commandBusService = inject(CommandBusService);

  public readonly icons = { faList, faCircleInfo, faRightFromBracket };

  public openAbout(): void {
    this.commandBusService.emit({ type: 'UI_OPEN_ABOUT' });
  }

  public disconnect(): void {
    this.commandBusService.emit({ type: 'UI_DISCONNECT' });
  }
}
