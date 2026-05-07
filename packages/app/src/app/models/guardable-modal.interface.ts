export interface GuardableModal {
  canDeactivate(): Promise<boolean>;
}
