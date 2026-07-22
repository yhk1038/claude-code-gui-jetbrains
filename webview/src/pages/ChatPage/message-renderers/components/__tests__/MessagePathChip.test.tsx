import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessagePathChip } from '../MessagePathChip';

const mockOpenFile = vi.fn(() => Promise.resolve());

vi.mock('@/adapters', () => ({
  getAdapter: () => ({
    openFile: mockOpenFile,
  }),
}));

vi.mock('@/contexts/WorkingDirContext', () => ({
  useWorkingDir: () => ({ workingDirectory: '/abs/project', setWorkingDirectory: vi.fn() }),
}));

describe('MessagePathChip', () => {
  beforeEach(() => {
    mockOpenFile.mockClear();
  });

  it('파일 토큰을 칩으로 렌더하고 토큰 텍스트를 그대로 표시한다', () => {
    render(<MessagePathChip token="@src/file.ts" />);
    expect(screen.getByText('@src/file.ts')).toBeInTheDocument();
  });

  it('파일 토큰 클릭 시 절대경로와 #L 라인을 함께 openFile에 전달한다', () => {
    render(<MessagePathChip token="@src/file.ts#L10-L25" />);
    fireEvent.click(screen.getByText('@src/file.ts#L10-L25'));
    expect(mockOpenFile).toHaveBeenCalledTimes(1);
    expect(mockOpenFile).toHaveBeenCalledWith('/abs/project/src/file.ts', 10);
  });

  it('#L 라인 앵커가 없는 토큰은 line 인자 없이 openFile을 호출한다', () => {
    render(<MessagePathChip token="@src/file.ts" />);
    fireEvent.click(screen.getByText('@src/file.ts'));
    expect(mockOpenFile).toHaveBeenCalledTimes(1);
    expect(mockOpenFile).toHaveBeenCalledWith('/abs/project/src/file.ts', undefined);
  });

  it('파일 토큰은 role=button 으로 클릭 가능하다', () => {
    render(<MessagePathChip token="@src/file.ts" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('폴더 토큰은 클릭해도 openFile을 호출하지 않는다', () => {
    render(<MessagePathChip token="@src/utils/" />);
    const chip = screen.getByText('@src/utils/');
    fireEvent.click(chip);
    expect(mockOpenFile).not.toHaveBeenCalled();
  });

  it('폴더 토큰은 role=button 이 아니다', () => {
    render(<MessagePathChip token="@src/utils/" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
