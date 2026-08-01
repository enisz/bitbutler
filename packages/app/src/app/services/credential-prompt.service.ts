import { Injectable, inject } from '@angular/core';
import type { ServerRecord } from '@bitbutler/shared';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { setModalInput } from '../utils/modal-input';
import { CommandBusService } from './command-bus.service';
import { ServerService } from './server.service';

export interface ResolvedCredentials {
  username?: string;
  password?: string;
}

type PromptableServer = Pick<ServerRecord, 'id' | 'name' | 'username' | 'has_password'>;

@Injectable({ providedIn: 'root' })
export class CredentialPromptService {
  private readonly modalService = inject(NgbModal);
  private readonly serverService = inject(ServerService);
  private readonly commandBusService = inject(CommandBusService);

  public needsPrompt(server: Pick<ServerRecord, 'username' | 'has_password'>): boolean {
    return !server.username || !server.has_password;
  }

  // null return means the user cancelled - callers must abort silently.
  public async resolve(server: PromptableServer): Promise<ResolvedCredentials | null> {
    const { CredentialPrompt } = await import('../modals/credential-prompt/credential-prompt');
    const credModalRef = this.modalService.open(CredentialPrompt);
    setModalInput(credModalRef, 'serverName', server.name);
    setModalInput(credModalRef, 'prefillUsername', server.username);

    let result: { username: string; password: string; save: boolean };
    try {
      result = await credModalRef.result;
    } catch {
      return null;
    }

    if (result.save && (result.username || result.password)) {
      await this.serverService.update(server.id, {
        username: result.username,
        password: result.password,
      });
      this.commandBusService.emit({ type: 'SERVER_UPDATED', id: server.id });
      return {};
    }

    return { username: result.username, password: result.password };
  }
}
