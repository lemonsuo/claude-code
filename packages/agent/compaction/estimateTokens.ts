/**
 * Token 估算 — 纯逻辑，接受估算函数作为参数。
 *
 * 从 microCompact.ts 提取，消除对 tokenEstimation / slowOperations 的直接依赖。
 */

const IMAGE_MAX_TOKEN_SIZE = 2000

export interface TokenEstimationDeps {
  /** 粗略 token 估算：text → token count */
  roughEstimate: (text: string) => number
  /** JSON 序列化（比 JSON.stringify 慢但安全） */
  jsonStringify: (value: unknown) => string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContentBlock = Record<string, any>

function calculateToolResultTokens(
  block: ContentBlock,
  deps: TokenEstimationDeps,
): number {
  if (!block.content) return 0
  if (typeof block.content === 'string') {
    return deps.roughEstimate(block.content)
  }
  if (!Array.isArray(block.content)) return 0
  return block.content.reduce((sum: number, item: ContentBlock) => {
    if (item.type === 'text') return sum + deps.roughEstimate(item.text)
    if (item.type === 'image' || item.type === 'document') return sum + IMAGE_MAX_TOKEN_SIZE
    return sum
  }, 0)
}

/**
 * 粗略估算消息的 token 数。
 * 对所有文本内容调用 roughEstimate，对 image/document 使用固定值。
 * 最终乘以 4/3 作为保守估计。
 */
export function estimateMessageTokens(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: Array<{ type: string; message?: { content?: any } }>,
  deps: TokenEstimationDeps,
): number {
  let totalTokens = 0

  for (const message of messages) {
    if (message.type !== 'user' && message.type !== 'assistant') continue
    const content = message.message?.content
    if (!Array.isArray(content)) continue

    for (const block of content as ContentBlock[]) {
      if (block.type === 'text') {
        totalTokens += deps.roughEstimate(block.text)
      } else if (block.type === 'tool_result') {
        totalTokens += calculateToolResultTokens(block, deps)
      } else if (block.type === 'image' || block.type === 'document') {
        totalTokens += IMAGE_MAX_TOKEN_SIZE
      } else if (block.type === 'thinking') {
        totalTokens += deps.roughEstimate(block.thinking)
      } else if (block.type === 'redacted_thinking') {
        totalTokens += deps.roughEstimate(block.data)
      } else if (block.type === 'tool_use') {
        totalTokens += deps.roughEstimate(
          block.name + deps.jsonStringify(block.input ?? {}),
        )
      } else {
        totalTokens += deps.roughEstimate(deps.jsonStringify(block))
      }
    }
  }

  return Math.ceil(totalTokens * (4 / 3))
}
