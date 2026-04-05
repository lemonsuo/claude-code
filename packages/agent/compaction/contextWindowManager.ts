/**
 * 上下文窗口管理器 — 纯逻辑部分。
 *
 * 从 autoCompact.ts 提取的阈值计算和 warning 状态逻辑。
 * 不依赖外部 IO，所有配置通过参数注入。
 */

import type { TokenWarningState } from '../types/compaction.js'

// ── 常量 ──

const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000

export const AUTOCOMPACT_BUFFER_TOKENS = 13_000
export const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000
export const ERROR_THRESHOLD_BUFFER_TOKENS = 20_000
export const MANUAL_COMPACT_BUFFER_TOKENS = 3_000
export const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

// ── 依赖接口 ──

export interface ContextWindowDeps {
  /** 获取模型上下文窗口大小 */
  getContextWindowSize(model: string, betas: string[]): number
  /** 获取模型最大输出 token 数 */
  getMaxOutputTokensForModel(model: string): number
  /** 获取 SDK betas */
  getSdkBetas(): string[]
  /** 读取环境变量 */
  getEnv(key: string): string | undefined
}

// ── 纯逻辑 ──

/**
 * 获取有效上下文窗口大小（减去摘要输出保留）。
 */
export function getEffectiveContextWindowSize(
  model: string,
  deps: ContextWindowDeps,
): number {
  const reservedTokensForSummary = Math.min(
    deps.getMaxOutputTokensForModel(model),
    MAX_OUTPUT_TOKENS_FOR_SUMMARY,
  )
  let contextWindow = deps.getContextWindowSize(model, deps.getSdkBetas())

  const autoCompactWindow = deps.getEnv('CLAUDE_CODE_AUTO_COMPACT_WINDOW')
  if (autoCompactWindow) {
    const parsed = parseInt(autoCompactWindow, 10)
    if (!isNaN(parsed) && parsed > 0) {
      contextWindow = Math.min(contextWindow, parsed)
    }
  }

  return contextWindow - reservedTokensForSummary
}

/**
 * 获取自动压缩阈值。
 */
export function getAutoCompactThreshold(
  model: string,
  deps: ContextWindowDeps,
): number {
  const effectiveContextWindow = getEffectiveContextWindowSize(model, deps)

  const autocompactThreshold =
    effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS

  // Override for easier testing of autocompact
  const envPercent = deps.getEnv('CLAUDE_AUTOCOMPACT_PCT_OVERRIDE')
  if (envPercent) {
    const parsed = parseFloat(envPercent)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      const percentageThreshold = Math.floor(
        effectiveContextWindow * (parsed / 100),
      )
      return Math.min(percentageThreshold, autocompactThreshold)
    }
  }

  return autocompactThreshold
}

/**
 * 计算 token 使用量与各阈值的关系。
 */
export function calculateTokenWarningState(
  tokenUsage: number,
  model: string,
  deps: ContextWindowDeps,
  autoCompactEnabled: boolean,
): TokenWarningState {
  const autoCompactThreshold = getAutoCompactThreshold(model, deps)
  const threshold = autoCompactEnabled
    ? autoCompactThreshold
    : getEffectiveContextWindowSize(model, deps)

  const percentLeft = Math.max(
    0,
    Math.round(((threshold - tokenUsage) / threshold) * 100),
  )

  const warningThreshold = threshold - WARNING_THRESHOLD_BUFFER_TOKENS
  const errorThreshold = threshold - ERROR_THRESHOLD_BUFFER_TOKENS

  const isAboveWarningThreshold = tokenUsage >= warningThreshold
  const isAboveErrorThreshold = tokenUsage >= errorThreshold

  const isAboveAutoCompactThreshold =
    autoCompactEnabled && tokenUsage >= autoCompactThreshold

  const actualContextWindow = getEffectiveContextWindowSize(model, deps)
  const defaultBlockingLimit =
    actualContextWindow - MANUAL_COMPACT_BUFFER_TOKENS

  // Allow override for testing
  const blockingLimitOverride = deps.getEnv('CLAUDE_CODE_BLOCKING_LIMIT_OVERRIDE')
  const parsedOverride = blockingLimitOverride
    ? parseInt(blockingLimitOverride, 10)
    : NaN
  const blockingLimit =
    !isNaN(parsedOverride) && parsedOverride > 0
      ? parsedOverride
      : defaultBlockingLimit

  const isAtBlockingLimit = tokenUsage >= blockingLimit

  return {
    percentLeft,
    isAboveWarningThreshold,
    isAboveErrorThreshold,
    isAboveAutoCompactThreshold,
    isAtBlockingLimit,
  }
}

/**
 * 检查 querySource 是否为主线程。
 */
export function isMainThreadSource(
  querySource: string | undefined,
): boolean {
  return !querySource || querySource.startsWith('repl_main_thread')
}
