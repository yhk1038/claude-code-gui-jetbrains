import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingKey, HostMode } from '@/types/settings';

// ---------------------------------------------------------------------------
// Mocks: SettingsContext + runtime detection
// ---------------------------------------------------------------------------

const updateSettingWithScopeMock = vi.fn();
let mockHostMode: HostMode = HostMode.EDITOR_TAB;
let mockIsJetBrains = true;

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { [SettingKey.HOST_MODE]: mockHostMode },
    updateSettingWithScope: updateSettingWithScopeMock,
  }),
}));

vi.mock('@/config/environment', () => ({
  isJetBrains: () => mockIsJetBrains,
}));

import { HostModeSection } from '../HostModeSection';

beforeEach(() => {
  updateSettingWithScopeMock.mockReset();
  mockHostMode = HostMode.EDITOR_TAB;
  mockIsJetBrains = true;
});

const getTrigger = () =>
  screen.getByRole('button', { name: /Open chats in/i }) as HTMLButtonElement;

describe('HostModeSection', () => {
  it('renders nothing in the browser (non-JetBrains) runtime', () => {
    mockIsJetBrains = false;
    const { container } = render(<HostModeSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the selector in the JetBrains runtime', () => {
    render(<HostModeSection />);
    expect(getTrigger()).toBeInTheDocument();
  });

  it('reflects the current editor-tab value', () => {
    mockHostMode = HostMode.EDITOR_TAB;
    render(<HostModeSection />);
    expect(getTrigger().textContent).toContain('Editor tab');
  });

  it('reflects the current tool-window value', () => {
    mockHostMode = HostMode.TOOL_WINDOW;
    render(<HostModeSection />);
    expect(getTrigger().textContent).toContain('Tool window');
  });

  it('offers both host modes', () => {
    render(<HostModeSection />);
    fireEvent.click(getTrigger());
    const labels = screen.getAllByRole('option').map((o) => o.textContent?.replace('✓', '').trim());
    expect(labels).toEqual(['Editor tab', 'Tool window']);
  });

  it('saves the chosen mode to the global scope', () => {
    render(<HostModeSection />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByRole('option', { name: 'Tool window' }));

    expect(updateSettingWithScopeMock).toHaveBeenCalledTimes(1);
    expect(updateSettingWithScopeMock).toHaveBeenCalledWith(
      SettingKey.HOST_MODE,
      HostMode.TOOL_WINDOW,
      'global',
    );
  });
});
