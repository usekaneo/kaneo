export class SyncLeaseBusyError extends Error {
  constructor() {
    super("Synchronization is busy; retry shortly");
    this.name = "SyncLeaseBusyError";
  }
}
