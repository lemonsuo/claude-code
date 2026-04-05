// Bridge: re-export from @anthropic/agent/compaction with feature() injection
import { feature } from 'bun:bundle'

export {
  getCompactPrompt,
  getPartialCompactPrompt,
  formatCompactSummary,
} from '../../../packages/agent/compaction/prompt.js'

import { getCompactUserSummaryMessage as _getCompactUserSummaryMessage } from '../../../packages/agent/compaction/prompt.js'

export function getCompactUserSummaryMessage(
  summary: string,
  suppressFollowUpQuestions?: boolean,
  transcriptPath?: string,
  recentMessagesPreserved?: boolean,
): string {
  // feature() can only be used directly in if/ternary
  const isProactiveActive =
    feature('PROACTIVE') ? true : feature('KAIROS') ? true : false

  return _getCompactUserSummaryMessage(
    summary,
    suppressFollowUpQuestions,
    transcriptPath,
    recentMessagesPreserved,
    isProactiveActive,
  )
}
