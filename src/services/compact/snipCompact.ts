/**
 * Snip Compact — Bridge 层：注入真实 deps，附加 analytics/logging。
 *
 * 核心策略逻辑在 packages/agent/compaction/snipCompactCore.ts 中，
 * 本文件负责：
 * 1. 组装 SnipCompactDeps（注入 randomUUID、tokenCountWithEstimation 等）
 * 2. 在 wrapper 函数中附加 logEvent / logForDebugging 调用
 * 3. 重新导出所有公共类型和函数，保持向后兼容
 */

import { randomUUID } from 'crypto'
import type { Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import { tokenCountWithEstimation } from '../../utils/tokens.js'
import { logEvent } from '../analytics/index.js'
import {
  SNIP_NUDGE_TEXT,
  isSnipMarkerMessage as _isSnipMarkerMessage,
  snipCompactCore,
  shouldNudgeForSnips as _shouldNudgeForSnips,
  type SnipMessage,
  type SnipCompactDeps,
} from '../../../packages/agent/compaction/snipCompactCore.js'
import { groupMessagesByApiRound } from './grouping.js'
import { getAutoCompactThreshold } from './autoCompact.js'

// ── 重新导出常量（向后兼容）──

export { SNIP_NUDGE_TEXT }

// ── 类型（向后兼容）──

export type SnipCompactResult = {
  /** 裁剪后的消息数组 */
  messages: Message[]
  /** 是否执行了裁剪 */
  executed: boolean
  /** 释放的 token 数（估算） */
  tokensFreed: number
  /** snip boundary 消息（如果有） */
  boundaryMessage?: Message
}

// ── 判断函数（向后兼容）──

/**
 * 检查消息是否为 snip 内部注册标记。
 * Bridge wrapper，委托给纯逻辑层。
 */
export function isSnipMarkerMessage(message: Message): boolean {
  return _isSnipMarkerMessage(message as SnipMessage)
}

// ── Deps 组装 ──

const realDeps: SnipCompactDeps = {
  groupMessagesByApiRound: (msgs: SnipMessage[]) =>
    groupMessagesByApiRound(msgs) as SnipMessage[][],
  tokenCountWithEstimation: (msgs: SnipMessage[]) =>
    tokenCountWithEstimation(msgs as Message[]),
  getAutoCompactThreshold,
  randomUUID,
  getEnv: (key: string) => process.env[key],
}

// ── Snip 运行时门控 ──

/**
 * 检查 snip 功能是否在运行时启用。
 * 由 feature flag HISTORY_SNIP 控制。
 */
export function isSnipRuntimeEnabled(): boolean {
  // Bridge 层提供此函数，消费者通过 require() 导入
  // 实际门控逻辑由 feature flag 和配置决定
  return true
}

// ── 核心 wrapper ──

/**
 * 执行 snip compact：按 API round 分组，从中间移除若干组，
 * 插入 snip boundary marker。
 *
 * Bridge wrapper：注入真实 deps，附加 analytics/logging。
 *
 * @param messages 当前消息数组
 * @param options.force 是否强制执行（忽略阈值检测）
 */
export function snipCompactIfNeeded(
  messages: Message[],
  options?: { force?: boolean },
): SnipCompactResult {
  const coreResult = snipCompactCore(
    messages as SnipMessage[],
    options,
    realDeps,
  )

  // 附加 analytics（仅在确实执行了裁剪时）
  if (coreResult.executed) {
    logEvent('tengu_snip_compact', {
      groupsRemoved: (coreResult.boundaryMessage?.compactMetadata?.snipGroupsRemoved as number) ?? 0,
      totalGroups: groupMessagesByApiRound(messages.filter(m => !_isSnipMarkerMessage(m as SnipMessage))).length,
      messagesRemoved:
        messages.length - coreResult.messages.length + (coreResult.boundaryMessage ? 1 : 0),
      tokensFreed: coreResult.tokensFreed,
      force: options?.force ?? false,
    })

    logForDebugging(
      `Snip compact: removed ${coreResult.boundaryMessage?.compactMetadata?.snipGroupsRemoved ?? 0} groups (~${coreResult.tokensFreed} tokens freed)`,
    )
  }

  return {
    messages: coreResult.messages as Message[],
    executed: coreResult.executed,
    tokensFreed: coreResult.tokensFreed,
    boundaryMessage: coreResult.boundaryMessage as Message | undefined,
  }
}

/**
 * 判断是否需要提示用户考虑使用 snip。
 * 当 context 使用量超过 80% 时返回 true。
 *
 * Bridge wrapper：注入真实 deps。
 */
export function shouldNudgeForSnips(messages: Message[]): boolean {
  return _shouldNudgeForSnips(
    messages as SnipMessage[],
    {
      tokenCountWithEstimation: realDeps.tokenCountWithEstimation,
      getAutoCompactThreshold: realDeps.getAutoCompactThreshold,
      getEnv: realDeps.getEnv,
    },
  )
}
