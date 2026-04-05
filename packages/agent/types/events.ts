// AgentEvent — 统一事件流类型
// AgentCore.run() 的唯一输出类型

import type { CoreMessage, Usage } from './messages.js'
import type { ToolResult, CoreTool, PermissionResult } from './tools.js'

// --- DoneReason ---

export type DoneReason =
  | 'end_turn' // LLM 返回 end_turn，无 tool_use
  | 'max_turns' // 达到 turn 上限
  | 'interrupted' // 用户中断
  | 'error' // 不可恢复错误
  | 'stop_hook' // stop hook 阻止继续
  | 'budget' // token 预算耗尽
  | 'idle' // 队友完成任务，发送 idle notification
  | 'shutdown' // Leader 请求关闭

// --- AgentEvent 联合类型 ---

export interface MessageEvent {
  type: 'message'
  message: CoreMessage
}

export interface StreamEvent {
  type: 'stream'
  /** 原始 SDK 流事件 */
  event: { type: string; [key: string]: unknown }
}

export interface ToolStartEvent {
  type: 'tool_start'
  toolUseId: string
  toolName: string
  input: unknown
}

export interface ToolProgressEvent {
  type: 'tool_progress'
  toolUseId: string
  progress: unknown
}

export interface ToolResultEvent {
  type: 'tool_result'
  toolUseId: string
  result: ToolResult
}

export interface PermissionRequestEvent {
  type: 'permission_request'
  tool: CoreTool
  input: unknown
  /** 消费者调用 resolve 返回权限决策 */
  resolve: (result: PermissionResult) => void
}

export interface CompactionEvent {
  type: 'compaction'
  before: CoreMessage[]
  after: CoreMessage[]
}

export interface RequestStartEvent {
  type: 'request_start'
  /** API 请求参数 */
  params: unknown
}

export interface DoneEvent {
  type: 'done'
  reason: DoneReason
  usage?: Usage
  error?: unknown
}

// --- Swarm 事件类型 ---

export interface SwarmMessageEvent {
  type: 'swarm_message'
  /** 发送者 ID */
  from: string
  /** 发送者名称 */
  fromName?: string
  /** 消息文本 */
  text: string
  /** 消息摘要 */
  summary?: string
}

export interface SwarmIdleEvent {
  type: 'swarm_idle'
  /** 队友工作摘要 */
  summary: string
}

export interface SwarmShutdownEvent {
  type: 'swarm_shutdown'
  /** 关闭原因 */
  reason: string
}

export type AgentEvent =
  | MessageEvent
  | StreamEvent
  | ToolStartEvent
  | ToolProgressEvent
  | ToolResultEvent
  | PermissionRequestEvent
  | CompactionEvent
  | RequestStartEvent
  | DoneEvent
  | SwarmMessageEvent
  | SwarmIdleEvent
  | SwarmShutdownEvent
