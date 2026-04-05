import { mock, describe, expect, test, beforeAll, afterAll } from "bun:test";

// Mock bun:bundle feature flags used by classifierDecision.ts
mock.module("bun:bundle", () => ({
  feature: (_name: string) => false,
}));

// Mock ALL transitive imports to avoid circular init issues
// The classifierDecision module imports ~20 tool modules, each with deep deps.
// We mock each one to provide just the tool name constants.

// Tool name constants (sourced from each module's actual exports)
mock.module("src/tools/FileReadTool/prompt.js", () => ({
  FILE_READ_TOOL_NAME: "Read",
  FILE_UNCHANGED_STUB: "",
  MAX_LINES_TO_READ: 2000,
  DESCRIPTION: "",
  LINE_FORMAT_INSTRUCTION: "",
  OFFSET_INSTRUCTION_DEFAULT: "",
  OFFSET_INSTRUCTION_TARGETED: "",
  renderPromptTemplate: () => "",
}));

mock.module("src/tools/GrepTool/prompt.js", () => ({
  GREP_TOOL_NAME: "Grep",
  DESCRIPTION: "",
  renderPromptTemplate: () => "",
}));

mock.module("src/tools/GlobTool/prompt.js", () => ({
  GLOB_TOOL_NAME: "Glob",
  DESCRIPTION: "",
  renderPromptTemplate: () => "",
}));

mock.module("src/tools/LSPTool/prompt.js", () => ({
  LSP_TOOL_NAME: "LSP",
  DESCRIPTION: "",
}));

mock.module("src/tools/ToolSearchTool/constants.js", () => ({
  TOOL_SEARCH_TOOL_NAME: "ToolSearch",
}));

mock.module("src/tools/ToolSearchTool/prompt.js", () => ({
  TOOL_SEARCH_TOOL_NAME: "ToolSearch",
  isDeferredTool: () => false,
  formatDeferredToolLine: () => "",
  getPrompt: () => "",
}));

mock.module("src/tools/ToolSearchTool/ToolSearchTool.ts", () => ({
  default: {},
}));

mock.module("src/tools/ListMcpResourcesTool/prompt.js", () => ({
  LIST_MCP_RESOURCES_TOOL_NAME: "ListMcpResourcesTool",
  DESCRIPTION: "",
  renderPromptTemplate: () => "",
}));

mock.module("src/tools/AskUserQuestionTool/prompt.js", () => ({
  ASK_USER_QUESTION_TOOL_NAME: "AskUserQuestion",
  DESCRIPTION: "",
  renderPromptTemplate: () => "",
}));

mock.module("src/tools/EnterPlanModeTool/constants.js", () => ({
  ENTER_PLAN_MODE_TOOL_NAME: "EnterPlanMode",
}));

mock.module("src/tools/ExitPlanModeTool/constants.js", () => ({
  EXIT_PLAN_MODE_TOOL_NAME: "ExitPlanMode",
  EXIT_PLAN_MODE_V2_TOOL_NAME: "ExitPlanMode",
}));

mock.module("src/tools/SendMessageTool/constants.js", () => ({
  SEND_MESSAGE_TOOL_NAME: "SendMessage",
}));

mock.module("src/tools/SleepTool/prompt.js", () => ({
  SLEEP_TOOL_NAME: "Sleep",
  DESCRIPTION: "",
  renderPromptTemplate: () => "",
}));

mock.module("src/tools/TaskCreateTool/constants.js", () => ({
  TASK_CREATE_TOOL_NAME: "TaskCreate",
}));

mock.module("src/tools/TaskGetTool/constants.js", () => ({
  TASK_GET_TOOL_NAME: "TaskGet",
}));

mock.module("src/tools/TaskListTool/constants.js", () => ({
  TASK_LIST_TOOL_NAME: "TaskList",
}));

mock.module("src/tools/TaskOutputTool/constants.js", () => ({
  TASK_OUTPUT_TOOL_NAME: "TaskOutput",
}));

mock.module("src/tools/TaskStopTool/prompt.js", () => ({
  TASK_STOP_TOOL_NAME: "TaskStop",
  DESCRIPTION: "",
  renderPromptTemplate: () => "",
}));

mock.module("src/tools/TaskUpdateTool/constants.js", () => ({
  TASK_UPDATE_TOOL_NAME: "TaskUpdate",
}));

mock.module("src/tools/TeamCreateTool/constants.js", () => ({
  TEAM_CREATE_TOOL_NAME: "TeamCreate",
}));

mock.module("src/tools/TeamDeleteTool/constants.js", () => ({
  TEAM_DELETE_TOOL_NAME: "TeamDelete",
}));

mock.module("src/tools/TodoWriteTool/constants.js", () => ({
  TODO_WRITE_TOOL_NAME: "TodoWrite",
}));

mock.module("src/tools/BashTool/toolName.js", () => ({
  BASH_TOOL_NAME: "Bash",
}));

mock.module("src/tools/REPLTool/constants.ts", () => ({
  REPL_TOOL_NAME: "REPL",
  REPL_ONLY_TOOLS: new Set([]),
  isReplModeEnabled: () => false,
}));

mock.module("src/utils/permissions/yoloClassifier.ts", () => ({
  YOLO_CLASSIFIER_TOOL_NAME: "classify_result",
}));

mock.module("src/utils/permissions/classifierShared.ts", () => ({
  extractToolUseBlocks: () => [],
  parseClassifierResponse: () => null,
}));

// Mock process.env.USER_TYPE to suppress ant-only tools
const originalUserType = process.env.USER_TYPE;
beforeAll(() => {
  process.env.USER_TYPE = "external";
});
afterAll(() => {
  if (originalUserType === undefined) {
    delete process.env.USER_TYPE;
  } else {
    process.env.USER_TYPE = originalUserType;
  }
});

const { isAutoModeAllowlistedTool } = await import("../classifierDecision");

describe("isAutoModeAllowlistedTool", () => {
  test("Read is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("Read")).toBe(true);
  });

  test("Grep is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("Grep")).toBe(true);
  });

  test("Glob is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("Glob")).toBe(true);
  });

  test("LSP is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("LSP")).toBe(true);
  });

  test("ToolSearch is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("ToolSearch")).toBe(true);
  });

  test("ListMcpResourcesTool is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("ListMcpResourcesTool")).toBe(true);
  });

  test("ReadMcpResourceTool is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("ReadMcpResourceTool")).toBe(true);
  });

  test("TodoWrite is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("TodoWrite")).toBe(true);
  });

  test("TaskCreate is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("TaskCreate")).toBe(true);
  });

  test("TaskGet is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("TaskGet")).toBe(true);
  });

  test("TaskUpdate is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("TaskUpdate")).toBe(true);
  });

  test("TaskList is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("TaskList")).toBe(true);
  });

  test("TaskStop is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("TaskStop")).toBe(true);
  });

  test("TaskOutput is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("TaskOutput")).toBe(true);
  });

  test("AskUserQuestion is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("AskUserQuestion")).toBe(true);
  });

  test("EnterPlanMode is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("EnterPlanMode")).toBe(true);
  });

  test("ExitPlanMode is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("ExitPlanMode")).toBe(true);
  });

  test("TeamCreate is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("TeamCreate")).toBe(true);
  });

  test("TeamDelete is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("TeamDelete")).toBe(true);
  });

  test("SendMessage is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("SendMessage")).toBe(true);
  });

  test("Sleep is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("Sleep")).toBe(true);
  });

  test("classify_result is allowlisted", () => {
    expect(isAutoModeAllowlistedTool("classify_result")).toBe(true);
  });

  // Dangerous tools — NOT allowlisted
  test("Bash is NOT allowlisted", () => {
    expect(isAutoModeAllowlistedTool("Bash")).toBe(false);
  });

  test("Write is NOT allowlisted", () => {
    expect(isAutoModeAllowlistedTool("Write")).toBe(false);
  });

  test("Edit is NOT allowlisted", () => {
    expect(isAutoModeAllowlistedTool("Edit")).toBe(false);
  });

  test("WebFetch is NOT allowlisted", () => {
    expect(isAutoModeAllowlistedTool("WebFetch")).toBe(false);
  });

  test("Agent is NOT allowlisted", () => {
    expect(isAutoModeAllowlistedTool("Agent")).toBe(false);
  });
});
