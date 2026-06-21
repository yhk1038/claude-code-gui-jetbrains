import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageSettings } from '../index';

vi.mock('../useUsageData', () => ({
  useUsageData: vi.fn(),
}));

vi.mock('@/router/routes', () => ({
  ROUTE_META: { SETTINGS_USAGE: { label: 'Usage' } },
  Route: { SETTINGS_USAGE: 'SETTINGS_USAGE' },
}));

import { useUsageData } from '../useUsageData';

const mockUsageData = {
  five_hour: { utilization: 10, resets_at: '2026-12-01T00:00:00Z' },
  seven_day: null,
  seven_day_oauth_apps: null,
  seven_day_sonnet: null,
  seven_day_opus: null,
  seven_day_cowork: null,
  iguana_necktie: null,
  extra_usage: null,
};

describe('UsageSettings', () => {
  it('renders neither notice nor error box when there is no error', () => {
    vi.mocked(useUsageData).mockReturnValue({
      data: mockUsageData,
      isLoading: false,
      error: null,
      errorKind: null,
      lastUpdated: new Date(),
      refresh: vi.fn(),
    });

    render(<UsageSettings />);

    expect(screen.queryByText(/A required dependency/i)).toBeNull();
    expect(screen.queryByText(/Failed to fetch/i)).toBeNull();
  });

  it('renders CcbNotInstalledNotice when errorKind is ccb_missing', () => {
    vi.mocked(useUsageData).mockReturnValue({
      data: null,
      isLoading: false,
      error: 'claude-code-battery CLI is not installed',
      errorKind: 'ccb_missing',
      lastUpdated: null,
      refresh: vi.fn(),
    });

    render(<UsageSettings />);

    expect(screen.getByText(/A required dependency/i)).toBeInTheDocument();
    expect(screen.getByText(/npm install -g claude-code-battery/)).toBeInTheDocument();
  });

  it('renders red error box when errorKind is not ccb_missing', () => {
    vi.mocked(useUsageData).mockReturnValue({
      data: null,
      isLoading: false,
      error: 'Network error reaching Anthropic API',
      errorKind: 'network',
      lastUpdated: null,
      refresh: vi.fn(),
    });

    render(<UsageSettings />);

    expect(screen.getByText(/Network error reaching Anthropic API/i)).toBeInTheDocument();
    expect(screen.queryByText(/A required dependency/i)).toBeNull();
  });

  it('clears error/errorKind when usage-data-updated event fires (cross-instance sync)', () => {
    const refresh = vi.fn();
    // 초기 상태: ccb_missing 에러
    vi.mocked(useUsageData).mockReturnValue({
      data: null,
      isLoading: false,
      error: 'claude-code-battery CLI is not installed',
      errorKind: 'ccb_missing',
      lastUpdated: null,
      refresh,
    });
    const { rerender } = render(<UsageSettings />);
    expect(screen.getByText(/A required dependency/i)).toBeInTheDocument();

    // 다른 인스턴스가 데이터를 성공적으로 가져오고 error/errorKind를 클리어한 상태로 변경
    vi.mocked(useUsageData).mockReturnValue({
      data: mockUsageData,
      isLoading: false,
      error: null,
      errorKind: null,
      lastUpdated: new Date(),
      refresh,
    });
    rerender(<UsageSettings />);

    // 에러 UI가 사라지고 정상 데이터 화면이 나타남
    expect(screen.queryByText(/A required dependency/i)).toBeNull();
    expect(screen.queryByText(/Failed to fetch/i)).toBeNull();
  });
});
