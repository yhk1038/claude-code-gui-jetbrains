export interface IPCMessage {
  type: string;
  requestId?: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}
