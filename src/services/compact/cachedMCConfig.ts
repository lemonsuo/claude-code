// Bridge: re-export from @anthropic/agent/compaction with GrowthBook injection
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'

export type { CachedMCConfig } from '../../../packages/agent/types/compaction.js'

export {
  DEFAULT_CACHED_MC_CONFIG,
} from '../../../packages/agent/compaction/cachedMCConfig.js'

import {
  getCachedMCConfig as _getCachedMCConfig,
} from '../../../packages/agent/compaction/cachedMCConfig.js'

/**
 * 获取 cached microcompact 的运行时配置。
 * 注入 GrowthBook getFeatureValue 和 process.env。
 */
export function getCachedMCConfig() {
  return _getCachedMCConfig({
    getFeatureValue: getFeatureValue_CACHED_MAY_BE_STALE,
    getEnv: (key: string) => process.env[key],
  })
}
