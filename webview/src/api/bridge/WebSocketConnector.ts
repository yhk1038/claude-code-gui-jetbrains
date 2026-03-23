// webview/src/api/bridge/WebSocketConnector.ts

import type { Connector, RawMessageHandler, ConnectionChangeHandler } from './Connector';
import { detectRuntime } from '../../config/environment';

export class WebSocketConnector implements Connector {
  private ws: WebSocket | null = null;
  private connected = false;
  private isConnecting = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers = new Set<RawMessageHandler>();
  private connectionChangeHandlers = new Set<ConnectionChangeHandler>();
  private disposed = false;

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.connected || this.isConnecting) return;
    this.disposed = false;

    return new Promise<void>((resolve, reject) => {
      this.connectInternal(resolve, reject);
    });
  }

  private connectInternal(
    onFirstConnect?: (value: void) => void,
    onFirstError?: (reason: Error) => void
  ): void {
    if (this.isConnecting || this.disposed) return;
    this.isConnecting = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const env = detectRuntime();
    const wsUrl = `${protocol}//${window.location.host}/ws?env=${env}`;
    console.log('[WebSocketConnector] Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      console.log('[WebSocketConnector] Connected');
      this.isConnecting = false;
      this.connected = true;
      this.notifyConnectionChange(true);
      onFirstConnect?.();
      // 첫 연결 후 이후 재연결에서는 호출하지 않도록 undefined 처리
      onFirstConnect = undefined;
      onFirstError = undefined;
    };

    ws.onmessage = (event) => {
      try {
        const message: IPCMessage = JSON.parse(event.data);
        this.messageHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('[WebSocketConnector] Error in message handler:', error);
          }
        });
      } catch (error) {
        console.error('[WebSocketConnector] Error parsing message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocketConnector] Disconnected');
      this.isConnecting = false;
      this.ws = null;
      this.connected = false;
      this.notifyConnectionChange(false);

      // 자동 재연결 (disposed 되지 않은 경우만)
      if (!this.disposed) {
        this.reconnectTimeout = setTimeout(() => {
          console.log('[WebSocketConnector] Attempting to reconnect...');
          this.connectInternal();
        }, 2000);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocketConnector] Error:', error);
      this.isConnecting = false;
      if (onFirstError) {
        onFirstError(new Error('WebSocket connection error'));
        onFirstError = undefined;
        onFirstConnect = undefined;
      }
    };
  }

  disconnect(): void {
    this.disposed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.onclose = null; // 재연결 방지
      this.ws.close();
      this.ws = null;
    }

    this.isConnecting = false;
    this.connected = false;
    this.notifyConnectionChange(false);
  }

  send(message: IPCMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * WebSocket OPEN 상태 대기 (이미 연결된 경우 즉시 resolve).
   * DEV 모드에서 send 전에 연결 대기용.
   */
  waitForConnection(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error('WebSocket connection timeout'));
        }
      }, 50);
    });
  }

  /**
   * ensureReady: 연결 대기. waitForConnection()에 위임.
   * Connector 인터페이스 구현.
   */
  async ensureReady(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;
    await this.waitForConnection();
  }

  onMessage(handler: RawMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onConnectionChange(handler: ConnectionChangeHandler): () => void {
    this.connectionChangeHandlers.add(handler);
    return () => {
      this.connectionChangeHandlers.delete(handler);
    };
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionChangeHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('[WebSocketConnector] Error in connection change handler:', error);
      }
    });
  }
}
