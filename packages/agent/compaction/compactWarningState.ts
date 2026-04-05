/**
 * Compact warning 状态管理。
 *
 * 纯逻辑：内联简单 store 实现，不依赖外部 state/store。
 * 跟踪是否应抑制 "context left until autocompact" 警告。
 * 在成功压缩后抑制（因为直到下次 API 响应才能获得准确 token 计数）。
 */

// ── 内联 store ──

type Listener = () => void

type SimpleStore<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}

function createSimpleStore<T>(initialState: T): SimpleStore<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,
    setState: (updater: (prev: T) => T) => {
      const prev = state
      const next = updater(prev)
      if (Object.is(next, prev)) return
      state = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// ── 全局 store 实例 ──

/**
 * Compact warning 抑制状态 store。
 * true = 已抑制（刚完成压缩），false = 正常显示警告。
 */
export const compactWarningStore = createSimpleStore<boolean>(false)

/** 抑制 compact 警告。成功压缩后调用。 */
export function suppressCompactWarning(): void {
  compactWarningStore.setState(() => true)
}

/** 清除 compact 警告抑制。新压缩尝试开始时调用。 */
export function clearCompactWarningSuppression(): void {
  compactWarningStore.setState(() => false)
}
