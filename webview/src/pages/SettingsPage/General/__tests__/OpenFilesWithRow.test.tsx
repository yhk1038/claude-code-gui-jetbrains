import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingKey } from '@/types/settings';

const updateSettingMock = vi.fn();
let mockIdeAttached = false;
let mockIdeProduct = '';
const sendMock = vi.fn();

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { [SettingKey.OPEN_FILES_WITH]: null },
    updateSetting: updateSettingMock,
    ideAttached: mockIdeAttached,
    ideProduct: mockIdeProduct,
  }),
}));

vi.mock('@/hooks/useBridge', () => ({
  useBridge: () => ({ send: sendMock }),
}));

import { OpenFilesWithRow } from '../OpenFilesWithRow';

beforeEach(() => {
  updateSettingMock.mockReset();
  sendMock.mockReset();
  sendMock.mockResolvedValue({ editors: [{ id: 'vscode', label: 'Visual Studio Code', isDefault: false }] });
  mockIdeAttached = false;
  mockIdeProduct = '';
});

describe('OpenFilesWithRow', () => {
  it('shows the attached IDE as a fixed value with its product badge (no picker)', () => {
    mockIdeAttached = true;
    mockIdeProduct = 'WebStorm';
    render(<OpenFilesWithRow />);

    expect(screen.getByText('WebStorm')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'WebStorm' })).toBeInTheDocument();
    // No editor detection round-trip when the IDE owns file opening.
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('shows a picker (system default) when no IDE is attached', async () => {
    mockIdeAttached = false;
    render(<OpenFilesWithRow />);

    expect(await screen.findByText('System default')).toBeInTheDocument();
    expect(screen.queryByText('WebStorm')).not.toBeInTheDocument();
    expect(sendMock).toHaveBeenCalled();
  });
});
