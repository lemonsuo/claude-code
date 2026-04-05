/**
 * Snip Compact Core — 纯逻辑层。
 *
 * 从 src/services/compact/snipCompact.ts 提取的核心策略逻辑，
 * 不依赖外部 IO（analytics、logging、process.env），
 * 所有 IO 通过 SnipCompactDeps 注入。
 */

// ── 消息类型（与 CompactableMessage 相同模式）──

export type SnipMessage = {
  type: string
  subtype?: string
  isMeta?: boolean
  uuid?: string
  content?: string
  level?: string
  timestamp?: string
  message?: {
    id?: string
    content?: unknown
    [key: string]: unknown
  }
  compactMetadata?: {
    trigger?: string
    preTokens?: number
    snipGroupsRemoved?: number
    [key: string]: unknown
  }
  [key: string]: unknown
}

// ── 常量 ──

export const SNIP_MARKER_SUBTYPE = 'snip_marker'
export const SNIP_BOUNDARY_SUBTYPE = 'snip_boundary'

/** 促使用户考虑 snip 的提示文本 */
export const SNIP_NUDGE_TEXT =
  'Your conversation is getting long. Consider using /compact to summarize earlier context.'

/** 至少保留最近 N 个 API round 分组 */
export const MIN_KEEP_GROUPS = 2

// ── 依赖接口 ──

export interface SnipCompactDeps {
  /** 按 API round 分组 */
  groupMessagesByApiRound: (messages: SnipMessage[]) => SnipMessage[][]
  /** 估算消息的 token 数 */
  tokenCountWithEstimation: (messages: SnipMessage[]) => number
  /** 获取自动压缩阈值 */
  getAutoCompactThreshold: (model: string) => number
  /** 生成 UUID */
  randomUUID: () => string
  /** 读取环境变量 */
  getEnv: (key: string) => string | undefined
}

// ── 结果类型 ──

export type SnipCompactResult = {
  /** 裁剪后的消息数组 */
  messages: SnipMessage[]
  /** 是否执行了裁剪 */
  executed: boolean
  /** 释放的 token 数（估算） */
  tokensFreed: number
  /** snip boundary 消息（如果有） */
  boundaryMessage?: SnipMessage
}

// ── 判断函数 ──

/**
 * 检查消息是否为 snip 内部注册标记。
 */
export function isSnipMarkerMessage(message: SnipMessage): boolean {
  return (
    message.type === 'system' &&
    message.subtype === SNIP_MARKER_SUBTYPE
  )
}

// ── 工厂函数 ──

/**
 * 从消息中间创建 snip boundary marker。
 */
export function createSnipBoundaryMessage(
  tokensFreed: number,
  groupsRemoved: number,
  randomUUID: () => string,
): SnipMessage {
  return {
    type: 'system',
    subtype: SNIP_BOUNDARY_SUBTYPE,
    content: `History snipped: ${groupsRemoved} round(s) removed (~${tokensFreed} tokens freed)`,
    isMeta: false,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    level: 'info',
    compactMetadata: {
      trigger: 'auto',
      preTokens: tokensFreed,
      snipGroupsRemoved: groupsRemoved,
    },
  }
}

// ── 核心逻辑 ──

/**
 * 执行 snip compact：按 API round 分组，从中间移除若干组，
 * 插入 snip boundary marker。
 *
 * 纯逻辑，不包含 analytics/logging。
 *
 * @param messages 当前消息数组
 * @param options.force 是否强制执行（忽略阈值检测）
 * @param deps 依赖注入
 */
export function snipCompactCore(
  messages: SnipMessage[],
  options: { force?: boolean } | undefined,
  deps: SnipCompactDeps,
): SnipCompactResult {
  // 清理已有的 snip markers（防止累积）
  const cleaned = messages.filter(m => !isSnipMarkerMessage(m))

  // 按 API round 分组
  const groups = deps.groupMessagesByApiRound(cleaned)

  // 至少需要 MIN_KEEP_GROUPS + 1 个可移除组
  if (groups.length < MIN_KEEP_GROUPS + 1) {
    return { messages: cleaned, executed: false, tokensFreed: 0 }
  }

  // 阈值检测：非强制模式下，只有超过阈值时才裁剪
  if (!options?.force) {
    const tokenCount = deps.tokenCountWithEstimation(cleaned)
    const threshold = deps.getAutoCompactThreshold(
      deps.getEnv('CLAUDE_CODE_MODEL') ?? 'claude-sonnet-4-6',
    )
    if (tokenCount < threshold * 0.9) {
      return { messages: cleaned, executed: false, tokensFreed: 0 }
    }
  }

  // 保留头部 1 组 + 尾部 MIN_KEEP_GROUPS 组
  const keepHeadGroups = 1
  const keepTailGroups = MIN_KEEP_GROUPS
  const removableGroups = groups.slice(keepHeadGroups, -keepTailGroups)

  if (removableGroups.length === 0) {
    return { messages: cleaned, executed: false, tokensFreed: 0 }
  }

  // 估算被移除消息的 token 数
  const removedMessages = removableGroups.flat()
  const tokensFreed = deps.tokenCountWithEstimation(removedMessages)

  // 构造新消息：头部 + snip boundary + 尾部
  const headGroups = groups.slice(0, keepHeadGroups)
  const tailGroups = groups.slice(-keepTailGroups)

  const boundaryMessage = createSnipBoundaryMessage(
    tokensFreed,
    removableGroups.length,
    deps.randomUUID,
  )

  const result = [
    ...headGroups.flat(),
    boundaryMessage,
    ...tailGroups.flat(),
  ]

  return {
    messages: result,
    executed: true,
    tokensFreed,
    boundaryMessage,
  }
}

/**
 * 判断是否需要提示用户考虑使用 snip。
 * 当 context 使用量超过 80% 时返回 true。
 *
 * 纯逻辑，通过 deps 注入 IO。
 */
export function shouldNudgeForSnips(
  messages: SnipMessage[],
  deps: Pick<SnipCompactDeps, 'tokenCountWithEstimation' | 'getAutoCompactThreshold' | 'getEnv'>,
): boolean {
  const tokenCount = deps.tokenCountWithEstimation(messages)
  const threshold = deps.getAutoCompactThreshold(
    deps.getEnv('CLAUDE_CODE_MODEL') ?? 'claude-sonnet-4-6',
  )
  return tokenCount >= threshold * 0.8
}
