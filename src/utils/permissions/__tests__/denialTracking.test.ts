import { describe, expect, test } from "bun:test";
import {
  createDenialTrackingState,
  recordDenial,
  recordSuccess,
  shouldFallbackToPrompting,
  DENIAL_LIMITS,
} from "../denialTracking";

describe("createDenialTrackingState", () => {
  test("returns initial state with zeros", () => {
    const state = createDenialTrackingState();
    expect(state).toEqual({ consecutiveDenials: 0, totalDenials: 0 });
  });
});

describe("recordDenial", () => {
  test("increments both counters", () => {
    const state = createDenialTrackingState();
    const next = recordDenial(state);
    expect(next).toEqual({ consecutiveDenials: 1, totalDenials: 1 });
  });

  test("accumulates across multiple denials", () => {
    let state = createDenialTrackingState();
    state = recordDenial(state);
    state = recordDenial(state);
    state = recordDenial(state);
    expect(state).toEqual({ consecutiveDenials: 3, totalDenials: 3 });
  });

  test("does not mutate original state", () => {
    const state = createDenialTrackingState();
    recordDenial(state);
    expect(state).toEqual({ consecutiveDenials: 0, totalDenials: 0 });
  });
});

describe("recordSuccess", () => {
  test("resets consecutive denials to zero", () => {
    let state = createDenialTrackingState();
    state = recordDenial(state);
    state = recordDenial(state);
    state = recordSuccess(state);
    expect(state.consecutiveDenials).toBe(0);
    expect(state.totalDenials).toBe(2);
  });

  test("does not reset total denials", () => {
    let state = createDenialTrackingState();
    state = recordDenial(state);
    state = recordSuccess(state);
    expect(state.totalDenials).toBe(1);
  });

  test("returns same state when consecutiveDenials is already 0", () => {
    const state = createDenialTrackingState();
    const result = recordSuccess(state);
    expect(result).toBe(state);
  });

  test("does not mutate original state", () => {
    let state = createDenialTrackingState();
    state = recordDenial(state);
    const snapshot = { ...state };
    recordSuccess(state);
    expect(state).toEqual(snapshot);
  });
});

describe("shouldFallbackToPrompting", () => {
  test("returns false for fresh state", () => {
    expect(shouldFallbackToPrompting(createDenialTrackingState())).toBe(false);
  });

  test("returns true when consecutive denials reach max", () => {
    let state = createDenialTrackingState();
    for (let i = 0; i < DENIAL_LIMITS.maxConsecutive; i++) {
      state = recordDenial(state);
    }
    expect(shouldFallbackToPrompting(state)).toBe(true);
  });

  test("returns false just below consecutive limit", () => {
    let state = createDenialTrackingState();
    for (let i = 0; i < DENIAL_LIMITS.maxConsecutive - 1; i++) {
      state = recordDenial(state);
    }
    expect(shouldFallbackToPrompting(state)).toBe(false);
  });

  test("returns true when total denials reach max", () => {
    let state = createDenialTrackingState();
    // Simulate total denials reaching max without hitting consecutive limit
    for (let i = 0; i < DENIAL_LIMITS.maxTotal; i++) {
      state = recordDenial(state);
      // Reset consecutive every 2 denials to avoid hitting consecutive limit
      if (i % 2 === 1) {
        state = recordSuccess(state);
      }
    }
    expect(state.totalDenials).toBeGreaterThanOrEqual(DENIAL_LIMITS.maxTotal);
    expect(shouldFallbackToPrompting(state)).toBe(true);
  });

  test("success resets consecutive but total still accumulates", () => {
    let state = createDenialTrackingState();
    // Alternate deny/success many times
    for (let i = 0; i < 40; i++) {
      state = recordDenial(state);
      state = recordSuccess(state);
    }
    // Total should be high but consecutive should be 0
    expect(state.consecutiveDenials).toBe(0);
    expect(state.totalDenials).toBe(40);
    expect(shouldFallbackToPrompting(state)).toBe(true);
  });
});
