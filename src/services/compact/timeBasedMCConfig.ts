// Bridge: re-export from @anthropic/agent/compaction with GrowthBook injection
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'

export type { TimeBasedMCConfig } from '../../../packages/agent/types/compaction.js'

import {
  getTimeBasedMCConfig as _getTimeBasedMCConfig,
} from '../../../packages/agent/compaction/timeBasedMCConfig.js'

/**
 * 获取 time-based microcompact 的运行时配置。
 * 注入 GrowthBook getFeatureValue。
 */
export function getTimeBasedMCConfig() {
  return _getTimeBasedMCConfig({
    getFeatureValue: getFeatureValue_CACHED_MAY_BE_STALE,
  })
}
