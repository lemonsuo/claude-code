// Bridge: re-export from @anthropic/agent/compaction with real deps injection
import { getSdkBetas } from '../../bootstrap/state.js'
import { getGlobalConfig } from '@anthropic/config'
import { getContextWindowForModel } from '../../utils/context.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { getMaxOutputTokensForModel } from '../api/claude.js'

import {
  getEffectiveContextWindowSize as _getEffectiveContextWindowSize,
  getAutoCompactThreshold as _getAutoCompactThreshold,
  calculateTokenWarningState as _calculateTokenWarningState,
  isMainThreadSource as _isMainThreadSource,
} from '../../../packages/agent/compaction/contextWindowManager.js'

export {
  AUTOCOMPACT_BUFFER_TOKENS,
  WARNING_THRESHOLD_BUFFER_TOKENS,
  ERROR_THRESHOLD_BUFFER_TOKENS,
  MANUAL_COMPACT_BUFFER_TOKENS,
  MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES,
} from '../../../packages/agent/compaction/contextWindowManager.js'

const deps = {
  getContextWindowSize: getContextWindowForModel,
  getMaxOutputTokensForModel,
  getSdkBetas,
  getEnv: (key: string) => process.env[key],
}

// Inline isAutoCompactEnabled to avoid circular dep with autoCompact.js
function isAutoCompactEnabled(): boolean {
  if (isEnvTruthy(process.env.DISABLE_COMPACT)) {
    return false
  }
  if (isEnvTruthy(process.env.DISABLE_AUTO_COMPACT)) {
    return false
  }
  const userConfig = getGlobalConfig()
  return userConfig.autoCompactEnabled
}

export function getEffectiveContextWindowSize(model: string): number {
  return _getEffectiveContextWindowSize(model, deps)
}

export function getAutoCompactThreshold(model: string): number {
  return _getAutoCompactThreshold(model, deps)
}

export function calculateTokenWarningState(
  tokenUsage: number,
  model: string,
): ReturnType<typeof _calculateTokenWarningState> {
  return _calculateTokenWarningState(tokenUsage, model, deps, isAutoCompactEnabled())
}

export { _isMainThreadSource as isMainThreadSource }
