/**
 * Time-based microcompact 配置。
 *
 * 纯逻辑：接受 getFeatureValue 函数参数，不直接导入 GrowthBook。
 * 当距离上一次 assistant 消息超过阈值时触发 content-clearing microcompact，
 * 因为服务端 prompt cache 几乎肯定已过期。
 */

import type { TimeBasedMCConfig } from '../types/compaction.js'

// ── 依赖接口 ──

export interface TimeBasedMCConfigDeps {
  /** 读取 GrowthBook 远程配置 */
  getFeatureValue<T>(key: string, defaultValue: T): T
}

// ── 默认值 ──

export const TIME_BASED_MC_CONFIG_DEFAULTS: TimeBasedMCConfig = {
  enabled: false,
  gapThresholdMinutes: 60,
  keepRecent: 5,
}

// ── 核心 ──

/**
 * 获取 time-based microcompact 的运行时配置。
 */
export function getTimeBasedMCConfig(deps: TimeBasedMCConfigDeps): TimeBasedMCConfig {
  // Hoist the GB read so exposure fires on every eval path
  return deps.getFeatureValue<TimeBasedMCConfig>(
    'tengu_slate_heron',
    TIME_BASED_MC_CONFIG_DEFAULTS,
  )
}
