import { Injectable } from '@angular/core';
import type { NewServer, ServerRecord } from '../models/server.model';

@Injectable({ providedIn: 'root' })
export class ServerService {
  public list(): Promise<ServerRecord[]> {
    return window.bitbutler.server.list();
  }

  public add(server: NewServer): Promise<{ id: string }> {
    return window.bitbutler.server.add(server);
  }

  public async update(id: string, changes: Partial<NewServer>): Promise<boolean> {
    const res = await window.bitbutler.server.update({ id, changes });
    return res.updated;
  }

  public async delete(id: string): Promise<boolean> {
    const res = await window.bitbutler.server.delete({ id });
    return res.deleted;
  }

  public getById(id: string): Promise<ServerRecord | null> {
    return window.bitbutler.server.getById({ id });
  }

  public getByHost(host: string): Promise<ServerRecord | null> {
    return window.bitbutler.server.getByHost({ host });
  }

  public setActive(id: string | null): void {
    window.bitbutler.server.setActive(id);
  }
}
