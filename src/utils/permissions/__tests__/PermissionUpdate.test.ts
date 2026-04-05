import { mock, describe, expect, test } from "bun:test";

// Mock dependencies
mock.module("src/utils/log.ts", () => ({
  logError: () => {},
  logToFile: () => {},
  getLogDisplayTitle: () => "",
  logEvent: () => {},
  logMCPError: () => {},
  logMCPDebug: () => {},
  dateToFilename: (d: Date) => d.toISOString().replace(/[:.]/g, "-"),
  getLogFilePath: () => "/tmp/mock-log",
  attachErrorLogSink: () => {},
  getInMemoryErrors: () => [],
  loadErrorLogs: async () => [],
  getErrorLogByIndex: async () => null,
  captureAPIRequest: () => {},
  _resetErrorLogForTesting: () => {},
}));

mock.module("src/utils/slowOperations.ts", () => ({
  jsonStringify: JSON.stringify,
  jsonParse: JSON.parse,
  slowLogging: { enabled: false },
  clone: (v: any) => structuredClone(v),
  cloneDeep: (v: any) => structuredClone(v),
  callerFrame: () => "",
  SLOW_OPERATION_THRESHOLD_MS: 100,
  writeFileSync_DEPRECATED: () => {},
}));

mock.module("src/utils/debug.ts", () => ({
  logForDebugging: () => {},
  isDebugMode: () => false,
  isDebugToStdErr: () => false,
  getMinDebugLogLevel: () => "warn",
  getDebugFilter: () => null,
  getDebugFilePath: () => null,
  enableDebugLogging: () => false,
  setHasFormattedOutput: () => {},
  getHasFormattedOutput: () => false,
  flushDebugLogs: async () => {},
  getDebugLogPath: () => "/tmp/mock-debug",
  logAntError: () => {},
}));

const {
  applyPermissionUpdate,
  applyPermissionUpdates,
  extractRules,
  hasRules,
  supportsPersistence,
  createReadRuleSuggestion,
} = await import("../PermissionUpdate");

import { getEmptyToolPermissionContext } from "../../../Tool";
import type { PermissionUpdate } from "../PermissionUpdateSchema";

// ─── Helpers ────────────────────────────────────────────────────────────

function makeContext() {
  return getEmptyToolPermissionContext();
}

// ─── extractRules ───────────────────────────────────────────────────────

describe("extractRules", () => {
  test("returns empty for undefined", () => {
    expect(extractRules(undefined)).toEqual([]);
  });

  test("returns empty for empty array", () => {
    expect(extractRules([])).toEqual([]);
  });

  test("extracts rules from addRules updates", () => {
    const updates: PermissionUpdate[] = [
      {
        type: "addRules",
        rules: [{ toolName: "Bash", ruleContent: "ls" }],
        behavior: "allow",
        destination: "session",
      },
    ];
    const rules = extractRules(updates);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.toolName).toBe("Bash");
  });

  test("ignores non-addRules updates", () => {
    const updates: PermissionUpdate[] = [
      { type: "setMode", mode: "bypassPermissions", destination: "session" },
    ];
    expect(extractRules(updates)).toEqual([]);
  });

  test("extracts from multiple addRules updates", () => {
    const updates: PermissionUpdate[] = [
      {
        type: "addRules",
        rules: [{ toolName: "Bash", ruleContent: "ls" }],
        behavior: "allow",
        destination: "session",
      },
      {
        type: "addRules",
        rules: [{ toolName: "Write", ruleContent: "*.txt" }],
        behavior: "deny",
        destination: "localSettings",
      },
    ];
    expect(extractRules(updates)).toHaveLength(2);
  });
});

// ─── hasRules ───────────────────────────────────────────────────────────

describe("hasRules", () => {
  test("returns false for undefined", () => {
    expect(hasRules(undefined)).toBe(false);
  });

  test("returns false when no addRules", () => {
    expect(hasRules([{ type: "setMode", mode: "bypassPermissions", destination: "session" }])).toBe(false);
  });

  test("returns true when addRules present", () => {
    expect(
      hasRules([{
        type: "addRules",
        rules: [{ toolName: "Bash" }],
        behavior: "allow",
        destination: "session",
      }])
    ).toBe(true);
  });
});

// ─── applyPermissionUpdate ──────────────────────────────────────────────

describe("applyPermissionUpdate", () => {
  test("setMode updates the mode", () => {
    const ctx = makeContext();
    const updated = applyPermissionUpdate(ctx, {
      type: "setMode",
      mode: "bypassPermissions",
      destination: "session",
    });
    expect(updated.mode).toBe("bypassPermissions");
  });

  test("addRules adds allow rules to the correct destination", () => {
    const ctx = makeContext();
    const updated = applyPermissionUpdate(ctx, {
      type: "addRules",
      rules: [{ toolName: "Bash", ruleContent: "ls" }],
      behavior: "allow",
      destination: "localSettings",
    });
    expect(updated.alwaysAllowRules["localSettings"]).toContain("Bash(ls)");
  });

  test("addRules adds deny rules", () => {
    const ctx = makeContext();
    const updated = applyPermissionUpdate(ctx, {
      type: "addRules",
      rules: [{ toolName: "Bash" }],
      behavior: "deny",
      destination: "userSettings",
    });
    expect(updated.alwaysDenyRules["userSettings"]).toContain("Bash");
  });

  test("addRules adds ask rules", () => {
    const ctx = makeContext();
    const updated = applyPermissionUpdate(ctx, {
      type: "addRules",
      rules: [{ toolName: "Write" }],
      behavior: "ask",
      destination: "session",
    });
    expect(updated.alwaysAskRules["session"]).toContain("Write");
  });

  test("addRules appends to existing rules", () => {
    let ctx = makeContext();
    ctx = applyPermissionUpdate(ctx, {
      type: "addRules",
      rules: [{ toolName: "Bash" }],
      behavior: "allow",
      destination: "localSettings",
    });
    ctx = applyPermissionUpdate(ctx, {
      type: "addRules",
      rules: [{ toolName: "Bash", ruleContent: "ls" }],
      behavior: "allow",
      destination: "localSettings",
    });
    expect(ctx.alwaysAllowRules["localSettings"]).toHaveLength(2);
  });

  test("replaceRules replaces all rules for a destination", () => {
    let ctx = makeContext();
    ctx = applyPermissionUpdate(ctx, {
      type: "addRules",
      rules: [{ toolName: "Bash" }, { toolName: "Write" }],
      behavior: "allow",
      destination: "localSettings",
    });
    ctx = applyPermissionUpdate(ctx, {
      type: "replaceRules",
      rules: [{ toolName: "Read" }],
      behavior: "allow",
      destination: "localSettings",
    });
    expect(ctx.alwaysAllowRules["localSettings"]).toEqual(["Read"]);
  });

  test("removeRules removes specified rules", () => {
    let ctx = makeContext();
    ctx = applyPermissionUpdate(ctx, {
      type: "addRules",
      rules: [{ toolName: "Bash" }, { toolName: "Write" }],
      behavior: "allow",
      destination: "localSettings",
    });
    ctx = applyPermissionUpdate(ctx, {
      type: "removeRules",
      rules: [{ toolName: "Bash" }],
      behavior: "allow",
      destination: "localSettings",
    });
    expect(ctx.alwaysAllowRules["localSettings"]).toEqual(["Write"]);
  });

  test("addDirectories adds working directories", () => {
    const ctx = makeContext();
    const updated = applyPermissionUpdate(ctx, {
      type: "addDirectories",
      directories: ["/tmp/work"],
      destination: "localSettings",
    });
    expect(updated.additionalWorkingDirectories.has("/tmp/work")).toBe(true);
    expect(updated.additionalWorkingDirectories.get("/tmp/work")!.source).toBe("localSettings");
  });

  test("removeDirectories removes working directories", () => {
    let ctx = makeContext();
    ctx = applyPermissionUpdate(ctx, {
      type: "addDirectories",
      directories: ["/tmp/work", "/tmp/other"],
      destination: "localSettings",
    });
    ctx = applyPermissionUpdate(ctx, {
      type: "removeDirectories",
      directories: ["/tmp/work"],
      destination: "localSettings",
    });
    expect(ctx.additionalWorkingDirectories.has("/tmp/work")).toBe(false);
    expect(ctx.additionalWorkingDirectories.has("/tmp/other")).toBe(true);
  });

  test("does not mutate original context", () => {
    const ctx = makeContext();
    applyPermissionUpdate(ctx, {
      type: "addRules",
      rules: [{ toolName: "Bash" }],
      behavior: "allow",
      destination: "localSettings",
    });
    expect(ctx.alwaysAllowRules["localSettings"]).toBeUndefined();
  });
});

// ─── applyPermissionUpdates ─────────────────────────────────────────────

describe("applyPermissionUpdates", () => {
  test("applies multiple updates sequentially", () => {
    const ctx = makeContext();
    const updates: PermissionUpdate[] = [
      {
        type: "addRules",
        rules: [{ toolName: "Bash" }],
        behavior: "allow",
        destination: "localSettings",
      },
      {
        type: "setMode",
        mode: "plan",
        destination: "session",
      },
    ];
    const result = applyPermissionUpdates(ctx, updates);
    expect(result.alwaysAllowRules["localSettings"]).toContain("Bash");
    expect(result.mode).toBe("plan");
  });

  test("returns original context for empty updates", () => {
    const ctx = makeContext();
    const result = applyPermissionUpdates(ctx, []);
    expect(result).toBe(ctx);
  });
});

// ─── supportsPersistence ────────────────────────────────────────────────

describe("supportsPersistence", () => {
  test("localSettings supports persistence", () => {
    expect(supportsPersistence("localSettings")).toBe(true);
  });

  test("userSettings supports persistence", () => {
    expect(supportsPersistence("userSettings")).toBe(true);
  });

  test("projectSettings supports persistence", () => {
    expect(supportsPersistence("projectSettings")).toBe(true);
  });

  test("session does not support persistence", () => {
    expect(supportsPersistence("session")).toBe(false);
  });

  test("cliArg does not support persistence", () => {
    expect(supportsPersistence("cliArg")).toBe(false);
  });
});

// ─── createReadRuleSuggestion ───────────────────────────────────────────

describe("createReadRuleSuggestion", () => {
  test("creates rule for relative directory", () => {
    const result = createReadRuleSuggestion("src/lib");
    expect(result).toBeDefined();
    expect(result!.type).toBe("addRules");
    expect(result!.rules[0]!.toolName).toBe("Read");
    expect(result!.rules[0]!.ruleContent).toBe("src/lib/**");
    expect(result!.behavior).toBe("allow");
    expect(result!.destination).toBe("session");
  });

  test("creates rule for absolute path with double-slash pattern", () => {
    const result = createReadRuleSuggestion("/home/user/project");
    expect(result).toBeDefined();
    expect(result!.rules[0]!.ruleContent).toBe("//home/user/project/**");
  });

  test("returns undefined for root directory", () => {
    expect(createReadRuleSuggestion("/")).toBeUndefined();
  });

  test("uses specified destination", () => {
    const result = createReadRuleSuggestion("src", "localSettings");
    expect(result!.destination).toBe("localSettings");
  });
});
