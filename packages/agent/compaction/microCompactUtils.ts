/**
 * microCompact 相关的纯工具函数。
 *
 * 从 src/services/compact/microCompact.ts 提取，零运行时依赖。
 */

/**
 * 遍历消息，收集所有 tool name 在给定集合中的 tool_use block ID（按出现顺序）。
 * 被 microcompact 的 cached / time-based 两条路径共享。
 */
export function collectCompactableToolIds(
  messages: Array<{ type: string; message?: { content?: unknown } }>,
  toolNames: Set<string>,
): string[] {
  const ids: string[] = []
  for (const message of messages) {
    if (message.type === 'assistant' && Array.isArray(message.message?.content)) {
      for (const block of message.message.content as Array<Record<string, unknown>>) {
        if (
          block.type === 'tool_use' &&
          typeof block.name === 'string' &&
          toolNames.has(block.name)
        ) {
          ids.push(block.id as string)
        }
      }
    }
  }
  return ids
}
