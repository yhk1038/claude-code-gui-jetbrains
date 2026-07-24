import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { parseRestrictedMarkdown } from '@/vendor/announcement-core/markdown';
import { RestrictedMarkdown } from '../RestrictedMarkdown';

describe('parseRestrictedMarkdown (vendored)', () => {
  it('빈 줄로 구분된 일반 텍스트를 문단(토큰)으로 분리한다', () => {
    const blocks = parseRestrictedMarkdown('first line\n\nsecond line');
    expect(blocks).toEqual([
      { type: 'paragraph', tokens: [{ type: 'text', text: 'first line' }] },
      { type: 'paragraph', tokens: [{ type: 'text', text: 'second line' }] },
    ]);
  });

  it('연속된 "- " 줄을 하나의 리스트 블록(토큰 배열)으로 묶는다', () => {
    const blocks = parseRestrictedMarkdown('- one\n- two\n- three');
    expect(blocks).toEqual([
      {
        type: 'list',
        items: [
          [{ type: 'text', text: 'one' }],
          [{ type: 'text', text: 'two' }],
          [{ type: 'text', text: 'three' }],
        ],
      },
    ]);
  });
});

describe('RestrictedMarkdown', () => {
  it('굵게(**bold**)를 <strong>으로 렌더한다', () => {
    render(<RestrictedMarkdown body="hello **world**" />);
    const strong = screen.getByText('world');
    expect(strong.tagName).toBe('STRONG');
  });

  it('안전한 스킴(https)의 링크는 target=_blank로 렌더한다', () => {
    render(<RestrictedMarkdown body="[docs](https://example.com/docs)" />);
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('javascript: 스킴 링크는 앵커 없이 라벨 텍스트만 남긴다', () => {
    render(<RestrictedMarkdown body="[click me](javascript:alert(1))" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('click me')).toBeInTheDocument();
  });

  it('리스트 줄은 <ul><li>로 렌더한다', () => {
    render(<RestrictedMarkdown body={'- item one\n- item two'} />);
    expect(screen.getByText('item one').closest('li')).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('본문에 <script> 태그를 넣어도 실행되지 않고 리터럴 텍스트로만 표시된다', () => {
    const { container } = render(<RestrictedMarkdown body="<script>window.__xss = true</script>" />);
    // 실행되지 않았는지 확인 (전역 플래그가 세워지지 않음)
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
    // dangerouslySetInnerHTML을 쓰지 않으므로 <script> 엘리먼트 자체가 생성되지 않는다.
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>window.__xss = true</script>');
  });
});
