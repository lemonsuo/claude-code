/**
 * API-based microcompact — 使用原生 context management API 的微压缩。
 *
 * 纯逻辑：接受 toolName 常量和环境变量函数参数，不直接导入工具模块。
 * 构造 clear_tool_uses / clear_thinking 策略，在 API 调用时发送。
 */

import type {
  ContextEditStrategy,
  ContextManagementConfig,
  ToolNameConstants,
} from '../types/compaction.js'

// ── 依赖接口 ──

export interface ApiMicrocompactDeps {
  /** 工具名称常量 */
  toolNames: ToolNameConstants
  /** 读取环境变量 */
  getEnv(key: string): string | undefined
}

// ── 常量 ──

// Default values for context management strategies
// Match client-side microcompact token values
const DEFAULT_MAX_INPUT_TOKENS = 180_000
const DEFAULT_TARGET_INPUT_TOKENS = 40_000

// ── 核心 ──

/**
 * 获取 API context management 配置。
 *
 * 根据环境变量和模型能力，构造 clear_tool_uses 和 clear_thinking 策略。
 */
export function getAPIContextManagement(
  deps: ApiMicrocompactDeps,
  options?: {
    hasThinking?: boolean
    isRedactThinkingActive?: boolean
    clearAllThinking?: boolean
  },
): ContextManagementConfig | undefined {
  const {
    hasThinking = false,
    isRedactThinkingActive = false,
    clearAllThinking = false,
  } = options ?? {}

  const strategies: ContextEditStrategy[] = []

  // 可清除结果的工具列表
  const TOOLS_CLEARABLE_RESULTS = [
    ...deps.toolNames.shellToolNames,
    deps.toolNames.glob,
    deps.toolNames.grep,
    deps.toolNames.fileRead,
    deps.toolNames.webFetch,
    deps.toolNames.webSearch,
  ]

  // 可清除 uses 的工具列表
  const TOOLS_CLEARABLE_USES = [
    deps.toolNames.fileEdit,
    deps.toolNames.fileWrite,
    deps.toolNames.notebookEdit,
  ]

  // Preserve thinking blocks in previous assistant turns.
  if (hasThinking && !isRedactThinkingActive) {
    strategies.push({
      type: 'clear_thinking_20251015',
      keep: clearAllThinking ? { type: 'thinking_turns', value: 1 } : 'all',
    })
  }

  // Tool clearing strategies are ant-only
  const userType = deps.getEnv('USER_TYPE')
  if (userType !== 'ant') {
    return strategies.length > 0 ? { edits: strategies } : undefined
  }

  const isEnvTruthy = (val: string | undefined): boolean => val === '1' || val === 'true'

  const useClearToolResults = isEnvTruthy(deps.getEnv('USE_API_CLEAR_TOOL_RESULTS'))
  const useClearToolUses = isEnvTruthy(deps.getEnv('USE_API_CLEAR_TOOL_USES'))

  if (!useClearToolResults && !useClearToolUses) {
    return strategies.length > 0 ? { edits: strategies } : undefined
  }

  if (useClearToolResults) {
    const triggerThreshold = deps.getEnv('API_MAX_INPUT_TOKENS')
      ? parseInt(deps.getEnv('API_MAX_INPUT_TOKENS')!)
      : DEFAULT_MAX_INPUT_TOKENS
    const keepTarget = deps.getEnv('API_TARGET_INPUT_TOKENS')
      ? parseInt(deps.getEnv('API_TARGET_INPUT_TOKENS')!)
      : DEFAULT_TARGET_INPUT_TOKENS

    strategies.push({
      type: 'clear_tool_uses_20250919',
      trigger: { type: 'input_tokens', value: triggerThreshold },
      clear_at_least: { type: 'input_tokens', value: triggerThreshold - keepTarget },
      clear_tool_inputs: TOOLS_CLEARABLE_RESULTS,
    })
  }

  if (useClearToolUses) {
    const triggerThreshold = deps.getEnv('API_MAX_INPUT_TOKENS')
      ? parseInt(deps.getEnv('API_MAX_INPUT_TOKENS')!)
      : DEFAULT_MAX_INPUT_TOKENS
    const keepTarget = deps.getEnv('API_TARGET_INPUT_TOKENS')
      ? parseInt(deps.getEnv('API_TARGET_INPUT_TOKENS')!)
      : DEFAULT_TARGET_INPUT_TOKENS

    strategies.push({
      type: 'clear_tool_uses_20250919',
      trigger: { type: 'input_tokens', value: triggerThreshold },
      clear_at_least: { type: 'input_tokens', value: triggerThreshold - keepTarget },
      exclude_tools: TOOLS_CLEARABLE_USES,
    })
  }

  return strategies.length > 0 ? { edits: strategies } : undefined
}
