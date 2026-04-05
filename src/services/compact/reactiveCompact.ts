/**
 * Reactive Compact — 响应式压缩：当 API 返回 prompt-too-long (413) 或
 * 媒体尺寸超限错误时，按 API round 分组从尾部剥离消息并重试。
 */

import { markPostCompaction } from 'src/bootstrap/state.js'
import type { QuerySource } from '../../constants/querySource.js'
import type { AssistantMessage, Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import { hasExactErrorMessage } from '../../utils/errors.js'
import type { CacheSafeParams } from '../../utils/forkedAgent.js'
import { logError } from '../../utils/log.js'
import {
  getMessagesAfterCompactBoundary,
} from '../../utils/messages.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../analytics/index.js'
import {
  isMediaSizeErrorMessage,
  isPromptTooLongMessage,
} from '../api/errors.js'
import {
  type CompactionResult,
  compactConversation,
  ERROR_MESSAGE_USER_ABORT,
} from './compact.js'
import { groupMessagesByApiRound } from './grouping.js'
import { runPostCompactCleanup } from './postCompactCleanup.js'

// ── 开关 ──

/**
 * 是否处于 reactive-only 模式（禁用 proactive autocompact）。
 */
export function isReactiveOnlyMode(): boolean {
  return false
}

/**
 * Reactive compact 是否启用 — 始终启用。
 */
export function isReactiveCompactEnabled(): boolean {
  return true
}

/**
 * 判断消息是否为 prompt-too-long API 错误。
 */
export function isWithheldPromptTooLong(message: Message): boolean {
  if (message.type !== 'assistant') return false
  return isPromptTooLongMessage(message as unknown as AssistantMessage)
}

/**
 * 判断消息是否为媒体尺寸超限 API 错误。
 */
export function isWithheldMediaSizeError(message: Message): boolean {
  if (message.type !== 'assistant') return false
  return isMediaSizeErrorMessage(message as unknown as AssistantMessage)
}

// ── 核心 ──

export async function reactiveCompactOnPromptTooLong(
  messages: Message[],
  cacheSafeParams: Record<string, unknown>,
  options: { customInstructions?: string; trigger?: string },
): Promise<{ ok: boolean; reason?: string; result?: CompactionResult }> {
  const activeMessages = getMessagesAfterCompactBoundary(messages)
  const groups = groupMessagesByApiRound(activeMessages)

  if (groups.length < 2) {
    return { ok: false, reason: 'too_few_groups' }
  }

  for (let dropCount = 1; dropCount < groups.length; dropCount++) {
    const keptGroups = groups.slice(dropCount)
    const keptMessages = keptGroups.flat()

    const prefixMessages = messages.filter(
      m => !activeMessages.includes(m),
    )
    const messagesToSummarize = [...prefixMessages, ...groups[0]!.flat()]

    try {
      const context = (cacheSafeParams as CacheSafeParams & {
        toolUseContext?: unknown
      }).toolUseContext as Parameters<typeof compactConversation>[1] | undefined

      if (!context) {
        return { ok: false, reason: 'error' }
      }

      const result = await compactConversation(
        messagesToSummarize,
        context,
        cacheSafeParams as CacheSafeParams,
        true,
        options.customInstructions,
        options.trigger === 'manual' ? false : true,
      )

      logEvent('tengu_reactive_compact_success', {
        trigger: (options.trigger ?? 'auto') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        droppedGroups: dropCount,
        totalGroups: groups.length,
        keptMessages: keptMessages.length,
        summarizedMessages: messagesToSummarize.length,
      })

      runPostCompactCleanup(options.trigger as QuerySource | undefined)
      markPostCompaction()

      return { ok: true, result }
    } catch (error) {
      if (hasExactErrorMessage(error, ERROR_MESSAGE_USER_ABORT)) {
        return { ok: false, reason: 'aborted' }
      }

      logError(error)
      logEvent('tengu_reactive_compact_attempt_failed', {
        droppedGroups: dropCount,
        totalGroups: groups.length,
        errorMessage: (error instanceof Error ? error.message : String(error)) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })

      continue
    }
  }

  logEvent('tengu_reactive_compact_exhausted', {
    totalGroups: groups.length,
    trigger: (options.trigger ?? 'auto') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })

  return { ok: false, reason: 'exhausted' }
}

export async function tryReactiveCompact(params: {
  hasAttempted: boolean
  querySource: string
  aborted: boolean
  messages: Message[]
  cacheSafeParams: Record<string, unknown>
}): Promise<CompactionResult | null> {
  if (params.hasAttempted || params.aborted) {
    return null
  }

  const lastAssistant = [...params.messages]
    .reverse()
    .find(m => m.type === 'assistant')

  if (!lastAssistant || !isWithheldPromptTooLong(lastAssistant)) {
    return null
  }

  logForDebugging(
    `Reactive compact: detected prompt-too-long error, attempting reactive compact`,
  )

  const outcome = await reactiveCompactOnPromptTooLong(
    params.messages,
    params.cacheSafeParams,
    { trigger: params.querySource },
  )

  if (outcome.ok && outcome.result) {
    return outcome.result
  }

  logForDebugging(
    `Reactive compact: failed (reason: ${outcome.reason ?? 'unknown'})`,
    { level: 'warn' },
  )

  return null
}
