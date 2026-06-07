import { describe, it, expect } from 'vitest';
import { selectKillablePids } from '../port-utils';

describe('selectKillablePids', () => {
  it('parses one PID per line', () => {
    expect(selectKillablePids('123\n456', 999)).toEqual([123, 456]);
  });

  it('excludes our own PID so the backend never kills itself', () => {
    expect(selectKillablePids('123\n777\n456', 777)).toEqual([123, 456]);
  });

  it('ignores blank lines and whitespace', () => {
    expect(selectKillablePids('  123 \n\n  456\n', 999)).toEqual([123, 456]);
  });

  it('drops non-numeric and non-positive values', () => {
    expect(selectKillablePids('abc\n0\n-5\n123', 999)).toEqual([123]);
  });

  it('returns empty array for empty input', () => {
    expect(selectKillablePids('', 999)).toEqual([]);
    expect(selectKillablePids('   \n  ', 999)).toEqual([]);
  });

  it('de-duplicates repeated PIDs', () => {
    expect(selectKillablePids('123\n123\n456', 999)).toEqual([123, 456]);
  });
});
