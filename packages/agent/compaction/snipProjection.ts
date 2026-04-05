/**
 * Snip Projection — 将完整消息列表投影为 snip 后的 UI 视图。
 */
import type { CoreMessage } from '../types/messages.js'

const SNIP_BOUNDARY_SUBTYPE = 'snip_boundary'

/**
 * 判断消息是否为 snip boundary（裁剪边界标记）。
 */
export function isSnipBoundaryMessage(message: CoreMessage): boolean {
  if (message.type !== 'system') return false
  return (message as { subtype?: string }).subtype === SNIP_BOUNDARY_SUBTYPE
}

/**
 * 将完整消息列表投影为 snip 后的 UI 视图。
 * 当消息列表中包含 snip boundary 时，boundary 之前的消息被折叠。
 * 如果没有 snip boundary，返回原始消息列表不变。
 */
export function projectSnippedView(messages: CoreMessage[]): CoreMessage[] {
  const boundaryIndex = messages.findIndex(m => isSnipBoundaryMessage(m))
  if (boundaryIndex === -1) return messages
  return messages.slice(boundaryIndex)
}
