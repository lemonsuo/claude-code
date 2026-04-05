// Bridge: re-export from @anthropic/agent/compaction with config injection
import type { CachedMCConfig } from '../../../packages/agent/types/compaction.js'

export type {
  CachedMCState,
  CacheEditsBlock,
  PinnedCacheEdits,
} from '../../../packages/agent/compaction/cachedMicrocompact.js'

export {
  createCachedMCState,
  resetCachedMCState,
  markToolsSentToAPI,
  registerToolResult,
  registerToolMessage,
  createCacheEditsBlock,
} from '../../../packages/agent/compaction/cachedMicrocompact.js'

import {
  getToolResultsToDelete as _getToolResultsToDelete,
  isCachedMicrocompactEnabled as _isCachedMicrocompactEnabled,
  isModelSupportedForCacheEditing as _isModelSupportedForCacheEditing,
  getCachedMCSimpleConfig as _getCachedMCSimpleConfig,
} from '../../../packages/agent/compaction/cachedMicrocompact.js'

import {
  getCachedMCConfig as _getFullConfig,
} from './cachedMCConfig.js'

// ── 便捷包装 ──

/**
 * 获取应删除的 tool_use_id 列表（注入当前配置）。
 */
export function getToolResultsToDelete(
  state: import('../../../packages/agent/compaction/cachedMicrocompact.js').CachedMCState,
): string[] {
  const config = _getFullConfig()
  return _getToolResultsToDelete(state, config)
}

/**
 * 检查 cached microcompact 是否启用（注入当前配置）。
 */
export function isCachedMicrocompactEnabled(): boolean {
  const config = _getFullConfig()
  return _isCachedMicrocompactEnabled(config)
}

/**
 * 检查给定模型是否支持 cache editing（注入当前配置）。
 */
export function isModelSupportedForCacheEditing(model: string): boolean {
  const config = _getFullConfig()
  return _isModelSupportedForCacheEditing(model, config)
}

/**
 * 获取当前 cached MC 运行时配置（简化版，只含阈值和保留数）。
 * 保持向后兼容的导出名称。
 */
export function getCachedMCConfig(): {
  triggerThreshold: number
  keepRecent: number
} {
  const config = _getFullConfig()
  return _getCachedMCSimpleConfig(config)
}
