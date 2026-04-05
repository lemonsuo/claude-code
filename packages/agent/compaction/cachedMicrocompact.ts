/**
 * Cached Microcompact 核心：基于 cache editing API 的微压缩。
 *
 * 纯逻辑：接受 config 参数，不直接导入 GrowthBook 配置。
 * 通过 Anthropic 内部 cache_edits API，在不破坏 prompt cache 前缀的前提下，
 * 从缓存的上下文中移除旧的 tool_result，从而减小 context 大小。
 */

import type { CachedMCConfig } from '../types/compaction.js'

// ── 类型 ──

export type CachedMCState = {
  /** 已注册的 tool_use_id 集合 */
  registeredTools: Set<string>
  /** tool_use_id 注册顺序（用于 LRU 选择） */
  toolOrder: string[]
  /** 已被 cache_edit 删除的 tool_use_id */
  deletedRefs: Set<string>
  /** 缓存已固定到特定 user message 位置的 edits */
  pinnedEdits: PinnedCacheEdits[]
  /** 标记本轮已发送给 API */
  toolsSentToAPI: boolean
}

export type CacheEditsBlock = {
  type: 'cache_edits'
  edits: Array<{ type: string; tool_use_id: string }>
}

export type PinnedCacheEdits = {
  userMessageIndex: number
  block: CacheEditsBlock
}

// ── 状态管理 ──

/**
 * 创建全新的 cached MC 状态实例。
 */
export function createCachedMCState(): CachedMCState {
  return {
    registeredTools: new Set(),
    toolOrder: [],
    deletedRefs: new Set(),
    pinnedEdits: [],
    toolsSentToAPI: false,
  }
}

/**
 * 重置状态（保留 pinnedEdits 供后续重放）。
 */
export function resetCachedMCState(state: CachedMCState): void {
  state.registeredTools.clear()
  state.toolOrder = []
  state.deletedRefs.clear()
  // pinnedEdits 保留 — 后续 API 调用需要重放已固定的 edits
  state.toolsSentToAPI = false
}

/**
 * 标记本轮所有已注册工具已发送给 API。
 */
export function markToolsSentToAPI(state: CachedMCState): void {
  state.toolsSentToAPI = true
}

// ── 注册 ──

/**
 * 注册单个 tool_result 对应的 tool_use_id。
 * 忽略重复注册和已删除的引用。
 */
export function registerToolResult(
  state: CachedMCState,
  toolId: string,
): void {
  if (state.deletedRefs.has(toolId)) return
  if (state.registeredTools.has(toolId)) return
  state.registeredTools.add(toolId)
  state.toolOrder.push(toolId)
}

/**
 * 注册同一条 user message 内的多个 tool_result 为一组。
 */
export function registerToolMessage(
  state: CachedMCState,
  groupIds: string[],
): void {
  for (const id of groupIds) {
    registerToolResult(state, id)
  }
}

// ── 删除决策 ──

/**
 * 根据配置的阈值，返回应被 cache_edit 删除的 tool_use_id 列表。
 *
 * 策略：保留最近 keepRecent 个工具，删除较早的。
 * 仅当已注册工具总数超过 triggerThreshold 时才触发。
 * 已被删除的引用不参与计算。
 */
export function getToolResultsToDelete(
  state: CachedMCState,
  config: CachedMCConfig,
): string[] {
  if (!config.enabled) return []

  // 计算当前活跃（未删除）的工具数
  const activeTools = state.toolOrder.filter(id => !state.deletedRefs.has(id))

  if (activeTools.length < config.triggerThreshold) return []

  // 保留最近 keepRecent 个，删除其余
  const keepRecent = Math.max(1, config.keepRecent)
  if (activeTools.length <= keepRecent) return []

  const toDelete = activeTools.slice(0, activeTools.length - keepRecent)

  // 立即标记为已删除，避免重复返回
  for (const id of toDelete) {
    state.deletedRefs.add(id)
  }

  return toDelete
}

// ── Cache Edits 构造 ──

/**
 * 为给定的 tool_use_id 列表构造 cache_edits API 块。
 * 将删除的 ID 记录到 state.deletedRefs 中。
 */
export function createCacheEditsBlock(
  state: CachedMCState,
  toolIds: string[],
): CacheEditsBlock | null {
  if (toolIds.length === 0) return null

  // 记录删除引用
  for (const id of toolIds) {
    state.deletedRefs.add(id)
  }

  return {
    type: 'cache_edits',
    edits: toolIds.map(id => ({
      type: 'delete_tool_result',
      tool_use_id: id,
    })),
  }
}

// ── 开关查询 ──

/**
 * 检查 cached microcompact 是否启用。
 */
export function isCachedMicrocompactEnabled(config: CachedMCConfig): boolean {
  return config.enabled
}

/**
 * 检查给定模型是否支持 cache editing API。
 */
export function isModelSupportedForCacheEditing(
  model: string,
  config: CachedMCConfig,
): boolean {
  if (config.supportedModels.length === 0) return true // 无白名单 = 全部支持
  return config.supportedModels.some(
    prefix => model === prefix || model.startsWith(prefix),
  )
}

/**
 * 获取当前 cached MC 运行时配置（简化版，只含阈值和保留数）。
 */
export function getCachedMCSimpleConfig(config: CachedMCConfig): {
  triggerThreshold: number
  keepRecent: number
} {
  return {
    triggerThreshold: config.triggerThreshold,
    keepRecent: config.keepRecent,
  }
}
