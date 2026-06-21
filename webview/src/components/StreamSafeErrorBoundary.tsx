import { Component, ErrorInfo, ReactNode } from 'react';
import { reportClientError } from '@/api/errorReporting';

interface SuppressedError {
  message: string;
  stack?: string;
  componentStack?: string;
  renderKey: string | number;
  timestamp: number;
}

declare global {
  interface Window {
    __suppressedRenderErrors?: SuppressedError[];
  }
}

interface Props {
  children: ReactNode;
  renderKey: string | number;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorRenderKey: string | number | null;
  /** getDerivedStateFromError 직후 플래그 — getDerivedStateFromProps에서 errorRenderKey 확정 전 리셋 방지 */
  pendingError: boolean;
}

export class StreamSafeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorRenderKey: null, pendingError: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, pendingError: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // 에러 직후: errorRenderKey를 현재 renderKey로 확정 (리셋 방지)
    if (state.pendingError) {
      return { pendingError: false, errorRenderKey: props.renderKey };
    }
    // renderKey가 변경되면 에러 상태 리셋 (새 데이터로 재시도)
    if (state.hasError && props.renderKey !== state.errorRenderKey) {
      return { hasError: false, errorRenderKey: null };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const entry: SuppressedError = {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      renderKey: this.props.renderKey,
      timestamp: Date.now(),
    };

    const errors = window.__suppressedRenderErrors ??= [];
    errors.push(entry);

    console.error(
      '[StreamSafe] Suppressed render error (%d total):',
      errors.length,
      error.message,
    );

    // Suppressed in the UI, but still reported via the single client reporting path.
    reportClientError(error, {
      source: 'render',
      componentStack: info.componentStack ?? undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
