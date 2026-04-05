// Compaction 类型 — 策略无关的接口定义
// 所有 compaction 策略共享这些类型

import type { CoreMessage } from './messages.js'

// ── Compaction Result ──

export interface CompactionResult {
  /** 是否执行了压缩 */
  compacted: boolean
  /** 压缩后的消息列表（未压缩则为原列表） */
  messages: CoreMessage[]
  /** 估算的 token 节省量 */
  tokensSaved?: number
}

// ── 触发类型 ──

export type CompactionTrigger = 'auto' | 'manual' | 'reactive' | 'snip'

// ── Compaction 上下文 ──

export interface CompactionContext {
  /** 当前模型 ID */
  model: string
  /** 当前消息的 token 估算 */
  tokenCount: number
  /** 自动压缩阈值 */
  autoCompactThreshold: number
  /** 有效上下文窗口大小 */
  effectiveContextWindow: number
  /** 查询来源（用于遥测） */
  querySource?: string
  /** 是否为主线程 */
  isMainThread: boolean
  /** Agent ID（如果是子 agent） */
  agentId?: string
}

// ── Context Window Manager ──

export interface TokenWarningState {
  percentLeft: number
  isAboveWarningThreshold: boolean
  isAboveErrorThreshold: boolean
  isAboveAutoCompactThreshold: boolean
  isAtBlockingLimit: boolean
}

// ── Snip Types ──

export interface SnipCompactResult {
  messages: CoreMessage[]
  executed: boolean
  tokensFreed: number
  boundaryMessage?: CoreMessage
}

// ── Microcompact Types ──

export interface MicrocompactResult {
  messages: CoreMessage[]
  compactionInfo?: {
    pendingCacheEdits?: {
      trigger: 'auto'
      deletedToolIds: string[]
      baselineCacheDeletedTokens: number
    }
  }
}

// ── Cached MC Types ──

export interface CachedMCConfig {
  enabled: boolean
  triggerThreshold: number
  keepRecent: number
  supportedModels: string[]
  systemPromptSuggestSummaries: boolean
}

export interface TimeBasedMCConfig {
  enabled: boolean
  gapThresholdMinutes: number
  keepRecent: number
}

// ── API Context Management ──

export type ContextEditStrategy =
  | {
      type: 'clear_tool_uses_20250919'
      trigger?: { type: 'input_tokens'; value: number }
      keep?: { type: 'tool_uses'; value: number }
      clear_tool_inputs?: boolean | string[]
      exclude_tools?: string[]
      clear_at_least?: { type: 'input_tokens'; value: number }
    }
  | {
      type: 'clear_thinking_20251015'
      keep: { type: 'thinking_turns'; value: number } | 'all'
    }

export interface ContextManagementConfig {
  edits: ContextEditStrategy[]
}

// ── Post-Compact Cleanup ──

export interface PostCompactCleanupActions {
  resetMicrocompactState(): void
  resetContextCollapse(): void
  clearUserContextCache(): void
  resetMemoryFilesCache(source: string): void
  clearSystemPromptSections(): void
  clearClassifierApprovals(): void
  clearSpeculativeChecks(): void
  clearBetaTracingState(): void
  clearSessionMessagesCache(): void
  sweepFileContentCache(): Promise<void>
}

// ── Tool Name Constants ──

export interface ToolNameConstants {
  fileEdit: string
  fileRead: string
  fileWrite: string
  glob: string
  grep: string
  webFetch: string
  webSearch: string
  notebookEdit: string
  shellToolNames: string[]
}

// ── Session Memory Compact Config ──

export interface SessionMemoryCompactConfig {
  minTokens: number
  minTextBlockMessages: number
  maxTokens: number
}
