import { describe, it, expect } from 'vitest';
import {
  clampAutoScrollThreshold,
  nextAutoFollow,
  shouldShowScrollToBottom,
  AUTO_SCROLL_THRESHOLD_DEFAULT,
  AUTO_SCROLL_THRESHOLD_MAX,
  AUTO_SCROLL_THRESHOLD_MIN,
  AUTO_SCROLL_RELEASE_EPS,
} from '../autoScroll';

describe('clampAutoScrollThreshold', () => {
  it('keeps in-range values unchanged', () => {
    expect(clampAutoScrollThreshold(80)).toBe(80);
    expect(clampAutoScrollThreshold(200)).toBe(200);
  });

  it('caps absurdly large values (issue #87: user set 20000)', () => {
    expect(clampAutoScrollThreshold(20000)).toBe(AUTO_SCROLL_THRESHOLD_MAX);
  });

  it('floors values below the minimum', () => {
    expect(clampAutoScrollThreshold(0)).toBe(AUTO_SCROLL_THRESHOLD_MIN);
    expect(clampAutoScrollThreshold(-5)).toBe(AUTO_SCROLL_THRESHOLD_MIN);
  });

  it('falls back to the default for non-finite input', () => {
    expect(clampAutoScrollThreshold(NaN)).toBe(AUTO_SCROLL_THRESHOLD_DEFAULT);
    expect(clampAutoScrollThreshold(Infinity)).toBe(AUTO_SCROLL_THRESHOLD_DEFAULT);
  });

  it('rounds fractional values', () => {
    expect(clampAutoScrollThreshold(80.6)).toBe(81);
  });
});

describe('nextAutoFollow', () => {
  const RESUME = 80;

  // release: the user scrolled up (scrollTop decreased past the EPS).
  it('releases (false) when the user scrolls up beyond the release EPS', () => {
    // far from bottom so resume cannot fire
    expect(nextAutoFollow(true, -(AUTO_SCROLL_RELEASE_EPS + 1), 500, RESUME)).toBe(false);
  });

  it('ignores tiny upward jitter within the release EPS', () => {
    // jitter smaller than EPS, still far from bottom -> keep previous state
    expect(nextAutoFollow(true, -(AUTO_SCROLL_RELEASE_EPS - 0.5), 500, RESUME)).toBe(true);
    expect(nextAutoFollow(false, -(AUTO_SCROLL_RELEASE_EPS - 0.5), 500, RESUME)).toBe(false);
  });

  // resume: the user must actively scroll DOWN to within the resume distance.
  it('resumes (true) when actively scrolling down within the resume distance', () => {
    expect(nextAutoFollow(false, 5, 10, RESUME)).toBe(true);
    expect(nextAutoFollow(false, AUTO_SCROLL_RELEASE_EPS + 1, RESUME, RESUME)).toBe(true);
  });

  it('does NOT resume just by sitting near the bottom (no downward scroll)', () => {
    // The bug the user hit: nudge up to read, release fires, then on the idle
    // tick (delta ~= 0) the view must stay put, not snap back to bottom.
    expect(nextAutoFollow(false, 0, 10, RESUME)).toBe(false);
    expect(nextAutoFollow(false, 0, RESUME, RESUME)).toBe(false);
  });

  it('does not resume while scrolling down but still beyond the resume distance', () => {
    expect(nextAutoFollow(false, 50, RESUME + 1, RESUME)).toBe(false);
  });

  // release takes priority over resume in the same tick (Lundis: scrolling up
  // must always stop following, even near the bottom).
  it('prioritizes release over resume when both could fire in one tick', () => {
    expect(nextAutoFollow(true, -(AUTO_SCROLL_RELEASE_EPS + 1), 10, RESUME)).toBe(false);
  });

  it('keeps the previous state when neither release nor resume applies', () => {
    // idle / content growth: delta ~= 0 -> unchanged
    expect(nextAutoFollow(true, 0, 500, RESUME)).toBe(true);
    expect(nextAutoFollow(false, 0, 500, RESUME)).toBe(false);
    // big block inserted at once: scrollTop unchanged (delta 0), dist jumps ->
    // must stay following (the issue #100 bug case)
    expect(nextAutoFollow(true, 0, 4000, RESUME)).toBe(true);
  });

  it('respects a custom release EPS argument', () => {
    expect(nextAutoFollow(true, -10, 500, RESUME, 20)).toBe(true);
    expect(nextAutoFollow(true, -25, 500, RESUME, 20)).toBe(false);
  });
});

describe('shouldShowScrollToBottom', () => {
  const THRESHOLD = 80;

  // The button is meaningful ONLY when all three hide-conditions are false:
  // auto-follow off AND there are messages AND the view is beyond the threshold.
  it('shows when auto-follow is off, has messages, and far from the bottom', () => {
    expect(shouldShowScrollToBottom(false, true, 500, THRESHOLD)).toBe(true);
  });

  // Hide-condition 1: auto-follow is active -> the view already tracks the bottom.
  it('hides while auto-follow is active, even when far from the bottom', () => {
    expect(shouldShowScrollToBottom(true, true, 500, THRESHOLD)).toBe(false);
  });

  // Hide-condition 2: no messages (an uninitialized session has nothing to scroll).
  it('hides when there are no messages', () => {
    expect(shouldShowScrollToBottom(false, false, 500, THRESHOLD)).toBe(false);
  });

  // Hide-condition 3: already within the threshold of the bottom.
  it('hides when within the threshold of the bottom', () => {
    expect(shouldShowScrollToBottom(false, true, THRESHOLD, THRESHOLD)).toBe(false);
    expect(shouldShowScrollToBottom(false, true, THRESHOLD - 1, THRESHOLD)).toBe(false);
    expect(shouldShowScrollToBottom(false, true, 0, THRESHOLD)).toBe(false);
  });

  // The exact bug: pinned near the bottom, a tiny upward nudge releases
  // auto-follow, but the position is still within the threshold -> stay hidden.
  it('stays hidden when auto-follow released but still within the threshold', () => {
    expect(shouldShowScrollToBottom(false, true, 10, THRESHOLD)).toBe(false);
  });

  it('shows just past the threshold boundary', () => {
    expect(shouldShowScrollToBottom(false, true, THRESHOLD + 1, THRESHOLD)).toBe(true);
  });
});
