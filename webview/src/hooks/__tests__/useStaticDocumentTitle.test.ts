import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStaticDocumentTitle } from '../useStaticDocumentTitle';

describe('useStaticDocumentTitle', () => {
  it('sets document.title to the given value on mount', () => {
    renderHook(() => useStaticDocumentTitle('Settings'));
    expect(document.title).toBe('Settings');
  });

  it('updates document.title when the value changes', () => {
    const { rerender } = renderHook(
      ({ title }) => useStaticDocumentTitle(title),
      { initialProps: { title: 'Settings' } },
    );
    expect(document.title).toBe('Settings');

    rerender({ title: 'Appearance' });
    expect(document.title).toBe('Appearance');
  });

  it('does nothing for an empty title (keeps the existing one)', () => {
    document.title = 'Existing';
    renderHook(() => useStaticDocumentTitle(''));
    expect(document.title).toBe('Existing');
  });
});
