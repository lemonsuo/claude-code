import { mock, describe, expect, test } from "bun:test";

// Mock log.ts to cut the heavy dependency chain
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

import { detectUnreachableRules, isSharedSettingSource } from "../shadowedRuleDetection";
import { getEmptyToolPermissionContext } from "../../../Tool";
import type { ToolPermissionContext } from "../../../Tool";

// ─── Helpers ────────────────────────────────────────────────────────────

function makeContext(opts: {
  denyRules?: string[];
  askRules?: string[];
  allowRules?: string[];
}): ToolPermissionContext {
  const ctx = getEmptyToolPermissionContext();
  const deny: Record<string, string[]> = {};
  const ask: Record<string, string[]> = {};
  const allow: Record<string, string[]> = {};

  if (opts.denyRules?.length) deny["localSettings"] = opts.denyRules;
  if (opts.askRules?.length) ask["localSettings"] = opts.askRules;
  if (opts.allowRules?.length) allow["localSettings"] = opts.allowRules;

  return { ...ctx, alwaysDenyRules: deny, alwaysAskRules: ask, alwaysAllowRules: allow } as any;
}

// ─── isSharedSettingSource ──────────────────────────────────────────────

describe("isSharedSettingSource", () => {
  test("projectSettings is shared", () => {
    expect(isSharedSettingSource("projectSettings")).toBe(true);
  });

  test("policySettings is shared", () => {
    expect(isSharedSettingSource("policySettings")).toBe(true);
  });

  test("command is shared", () => {
    expect(isSharedSettingSource("command")).toBe(true);
  });

  test("userSettings is not shared", () => {
    expect(isSharedSettingSource("userSettings")).toBe(false);
  });

  test("localSettings is not shared", () => {
    expect(isSharedSettingSource("localSettings")).toBe(false);
  });

  test("cliArg is not shared", () => {
    expect(isSharedSettingSource("cliArg")).toBe(false);
  });
});

// ─── detectUnreachableRules ─────────────────────────────────────────────

describe("detectUnreachableRules", () => {
  const options = { sandboxAutoAllowEnabled: false };

  test("returns empty when no rules", () => {
    const ctx = makeContext({});
    expect(detectUnreachableRules(ctx, options)).toEqual([]);
  });

  test("returns empty when only allow rules exist", () => {
    const ctx = makeContext({ allowRules: ["Bash(ls:*)"] });
    expect(detectUnreachableRules(ctx, options)).toEqual([]);
  });

  test("detects allow rule shadowed by tool-wide deny rule", () => {
    const ctx = makeContext({
      denyRules: ["Bash"],
      allowRules: ["Bash(ls:*)"],
    });
    const result = detectUnreachableRules(ctx, options);
    expect(result).toHaveLength(1);
    expect(result[0]!.shadowType).toBe("deny");
    expect(result[0]!.rule.ruleValue.toolName).toBe("Bash");
    expect(result[0]!.shadowedBy.ruleValue.toolName).toBe("Bash");
    expect(result[0]!.reason).toContain("deny");
    expect(result[0]!.fix).toContain("deny");
  });

  test("detects allow rule shadowed by tool-wide ask rule", () => {
    const ctx = makeContext({
      askRules: ["Bash"],
      allowRules: ["Bash(ls:*)"],
    });
    const result = detectUnreachableRules(ctx, options);
    expect(result).toHaveLength(1);
    expect(result[0]!.shadowType).toBe("ask");
    expect(result[0]!.reason).toContain("ask");
  });

  test("deny shadowing takes priority over ask shadowing", () => {
    const ctx = makeContext({
      denyRules: ["Bash"],
      askRules: ["Bash"],
      allowRules: ["Bash(ls:*)"],
    });
    const result = detectUnreachableRules(ctx, options);
    expect(result).toHaveLength(1);
    expect(result[0]!.shadowType).toBe("deny");
  });

  test("tool-wide allow rule is not shadowed by ask", () => {
    // A tool-wide allow (e.g. "Bash") without specific content is not shadowed
    const ctx = makeContext({
      askRules: ["Bash"],
      allowRules: ["Bash"],
    });
    expect(detectUnreachableRules(ctx, options)).toEqual([]);
  });

  test("specific deny rule does not shadow allow rule", () => {
    // "Bash(rm -rf)" is specific, not tool-wide — doesn't shadow
    const ctx = makeContext({
      denyRules: ["Bash(rm -rf)"],
      allowRules: ["Bash(ls:*)"],
    });
    expect(detectUnreachableRules(ctx, options)).toEqual([]);
  });

  test("different tool deny does not shadow allow", () => {
    const ctx = makeContext({
      denyRules: ["Write"],
      allowRules: ["Bash(ls:*)"],
    });
    expect(detectUnreachableRules(ctx, options)).toEqual([]);
  });

  test("detects multiple shadowed rules across tools", () => {
    const ctx = makeContext({
      denyRules: ["Bash"],
      askRules: ["Write"],
      allowRules: ["Bash(ls:*)", "Write(foo.txt)"],
    });
    const result = detectUnreachableRules(ctx, options);
    expect(result).toHaveLength(2);
    const types = result.map(r => r.shadowType);
    expect(types).toContain("deny");
    expect(types).toContain("ask");
  });

  test("Bash allow rule not shadowed by personal ask when sandbox enabled", () => {
    const ctx = makeContext({
      askRules: ["Bash"], // localSettings is personal
      allowRules: ["Bash(ls:*)"],
    });
    const result = detectUnreachableRules(ctx, { sandboxAutoAllowEnabled: true });
    // localSettings is personal → sandbox exception applies
    expect(result).toHaveLength(0);
  });

  test("Bash allow rule still shadowed by shared ask even with sandbox enabled", () => {
    const ctx = getEmptyToolPermissionContext();
    const allow: Record<string, string[]> = { localSettings: ["Bash(ls:*)"] };
    const ask: Record<string, string[]> = { projectSettings: ["Bash"] }; // shared source
    (ctx as any).alwaysAllowRules = allow;
    (ctx as any).alwaysAskRules = ask;
    const result = detectUnreachableRules(ctx, { sandboxAutoAllowEnabled: true });
    expect(result).toHaveLength(1);
    expect(result[0]!.shadowType).toBe("ask");
  });
});
