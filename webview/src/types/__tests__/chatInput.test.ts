import { describe, it, expect } from 'vitest';
import {
  InputModeValues,
  INPUT_MODES,
  MODE_CYCLE,
  getAvailableModes,
  INPUT_MODE_TO_CLI_FLAG,
  CLI_FLAG_TO_INPUT_MODE,
} from '../chatInput';

describe('auto mode wiring', () => {
  it('exposes the AUTO input mode value', () => {
    expect(InputModeValues.AUTO).toBe('auto');
  });

  it('maps auto both ways to the CLI --permission-mode value', () => {
    expect(INPUT_MODE_TO_CLI_FLAG[InputModeValues.AUTO]).toBe('auto');
    expect(CLI_FLAG_TO_INPUT_MODE['auto']).toBe(InputModeValues.AUTO);
  });

  it('has a render config for auto', () => {
    expect(INPUT_MODES.auto).toBeDefined();
    expect(INPUT_MODES.auto.id).toBe('auto');
    expect(INPUT_MODES.auto.label).toBe('Auto mode');
  });

  it('includes auto in the cycle list', () => {
    expect(MODE_CYCLE).toContain(InputModeValues.AUTO);
  });
});

describe('getAvailableModes', () => {
  it('excludes auto when autoAvailable is false (default)', () => {
    expect(getAvailableModes(false)).not.toContain(InputModeValues.AUTO);
    expect(getAvailableModes(false, false)).not.toContain(InputModeValues.AUTO);
  });

  it('includes auto only when autoAvailable is true', () => {
    expect(getAvailableModes(false, true)).toContain(InputModeValues.AUTO);
  });

  it('excludes bypass when bypassDisabled, independently of auto', () => {
    const modes = getAvailableModes(true, true);
    expect(modes).not.toContain(InputModeValues.BYPASS);
    expect(modes).toContain(InputModeValues.AUTO);
  });

  it('keeps the always-available modes regardless of flags', () => {
    const modes = getAvailableModes(false, false);
    expect(modes).toEqual(
      expect.arrayContaining([
        InputModeValues.PLAN,
        InputModeValues.ASK_BEFORE_EDIT,
        InputModeValues.AUTO_EDIT,
      ]),
    );
  });
});
