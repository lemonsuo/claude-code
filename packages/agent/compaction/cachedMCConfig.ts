/**
 * GrowthBook 配置：cached microcompact (cache editing API)。
 *
 * 纯逻辑：接受 getFeatureValue 函数参数，不直接导入 GrowthBook。
 * 从远程配置读取 tengu_cached_microcompact 实验配置，
 * 提供 enabled / triggerThreshold / keepRecent / supportedModels 等字段。
 * 当远程配置不可用时使用本地默认值；支持环境变量覆盖。
 */

import type { CachedMCConfig } from '../types/compaction.js'

// ── 依赖接口 ──

export interface CachedMCConfigDeps {
  /** 读取 GrowthBook 远程配置 */
  getFeatureValue<T>(key: string, defaultValue: T): T
  /** 读取环境变量 */
  getEnv(key: string): string | undefined
}

// ── 默认值 ──

export const DEFAULT_CACHED_MC_CONFIG: CachedMCConfig = {
  enabled: true,
  triggerThreshold: 20,
  keepRecent: 5,
  supportedModels: [
    'claude-sonnet-4',
    'claude-opus-4',
    'claude-3-5-sonnet',
    'claude-3-7-sonnet',
  ],
  systemPromptSuggestSummaries: false,
}

// ── 核心 ──

/**
 * 获取 cached microcompact 的运行时配置。
 *
 * 优先级：环境变量 > 远程配置 > 本地默认值。
 */
export function getCachedMCConfig(deps: CachedMCConfigDeps): CachedMCConfig {
  // 环境变量覆盖（用于测试 / 离线调试）
  const envEnabled = deps.getEnv('CLAUDE_CACHED_MC_ENABLED')
  if (envEnabled !== undefined) {
    return {
      enabled: envEnabled === '1',
      triggerThreshold:
        parseInt(deps.getEnv('CLAUDE_CACHED_MC_TRIGGER') ?? '', 10) ||
        DEFAULT_CACHED_MC_CONFIG.triggerThreshold,
      keepRecent:
        parseInt(deps.getEnv('CLAUDE_CACHED_MC_KEEP_RECENT') ?? '', 10) ||
        DEFAULT_CACHED_MC_CONFIG.keepRecent,
      supportedModels: DEFAULT_CACHED_MC_CONFIG.supportedModels,
      systemPromptSuggestSummaries:
        deps.getEnv('CLAUDE_CACHED_MC_SUGGEST_SUMMARIES') === '1',
    }
  }

  // 远程配置
  const remoteConfig = deps.getFeatureValue<CachedMCConfig>(
    'tengu_cached_microcompact',
    DEFAULT_CACHED_MC_CONFIG,
  )
  return remoteConfig ?? DEFAULT_CACHED_MC_CONFIG
}
