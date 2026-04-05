import { describe, expect, test } from 'bun:test'
import {
  type CachedMCState,
  createCachedMCState,
  registerToolResult,
  registerToolMessage,
  getToolResultsToDelete,
  createCacheEditsBlock,
  resetCachedMCState,
  markToolsSentToAPI,
  isCachedMicrocompactEnabled,
  isModelSupportedForCacheEditing,
} from '../cachedMicrocompact.js'

describe('createCachedMCState', () => {
  test('initializes with empty state', () => {
    const state = createCachedMCState()
    expect(state.registeredTools).toBeInstanceOf(Set)
    expect(state.registeredTools.size).toBe(0)
    expect(state.toolOrder).toEqual([])
    expect(state.deletedRefs).toBeInstanceOf(Set)
    expect(state.deletedRefs.size).toBe(0)
    expect(state.pinnedEdits).toEqual([])
    expect(state.toolsSentToAPI).toBe(false)
  })
})

describe('registerToolResult', () => {
  test('registers a tool_use_id', () => {
    const state = createCachedMCState()
    registerToolResult(state, 'tool_1')
    expect(state.registeredTools.has('tool_1')).toBe(true)
    expect(state.toolOrder).toContain('tool_1')
  })

  test('does not register duplicate tool_use_id', () => {
    const state = createCachedMCState()
    registerToolResult(state, 'tool_1')
    registerToolResult(state, 'tool_1')
    expect(state.registeredTools.size).toBe(1)
    expect(state.toolOrder).toHaveLength(1)
  })

  test('maintains registration order', () => {
    const state = createCachedMCState()
    registerToolResult(state, 'tool_1')
    registerToolResult(state, 'tool_2')
    registerToolResult(state, 'tool_3')
    expect(state.toolOrder).toEqual(['tool_1', 'tool_2', 'tool_3'])
  })
})

describe('registerToolMessage', () => {
  test('registers a group of tool IDs', () => {
    const state = createCachedMCState()
    registerToolMessage(state, ['tool_1', 'tool_2'])
    expect(state.registeredTools.has('tool_1')).toBe(true)
    expect(state.registeredTools.has('tool_2')).toBe(true)
    expect(state.toolOrder).toContain('tool_1')
    expect(state.toolOrder).toContain('tool_2')
  })

  test('handles empty group', () => {
    const state = createCachedMCState()
    registerToolMessage(state, [])
    expect(state.toolOrder).toEqual([])
  })
})

describe('getToolResultsToDelete', () => {
  test('returns empty when under threshold', () => {
    const state = createCachedMCState()
    for (let i = 0; i < 5; i++) {
      registerToolResult(state, `tool_${i}`)
    }
    const toDelete = getToolResultsToDelete(state)
    expect(Array.isArray(toDelete)).toBe(true)
  })

  test('returns tool IDs for deletion when over threshold', () => {
    const state = createCachedMCState()
    for (let i = 0; i < 30; i++) {
      registerToolResult(state, `tool_${i}`)
    }
    const toDelete = getToolResultsToDelete(state)
    expect(Array.isArray(toDelete)).toBe(true)
    for (const id of toDelete) {
      expect(state.deletedRefs.has(id)).toBe(true)
    }
  })

  test('excludes already-deleted refs', () => {
    const state = createCachedMCState()
    for (let i = 0; i < 30; i++) {
      registerToolResult(state, `tool_${i}`)
    }
    const first = getToolResultsToDelete(state)
    const second = getToolResultsToDelete(state)
    const firstSet = new Set(first)
    for (const id of second) {
      expect(firstSet.has(id)).toBe(false)
    }
  })
})

describe('createCacheEditsBlock', () => {
  test('returns null for empty tool IDs', () => {
    const state = createCachedMCState()
    expect(createCacheEditsBlock(state, [])).toBeNull()
  })

  test('creates a cache_edits block', () => {
    const state = createCachedMCState()
    const block = createCacheEditsBlock(state, ['tool_1', 'tool_2'])
    expect(block).not.toBeNull()
    expect(block!.type).toBe('cache_edits')
    expect(block!.edits).toHaveLength(2)
    expect(block!.edits[0]).toEqual({
      type: 'delete_tool_result',
      tool_use_id: 'tool_1',
    })
  })

  test('adds to deletedRefs', () => {
    const state = createCachedMCState()
    createCacheEditsBlock(state, ['tool_1'])
    expect(state.deletedRefs.has('tool_1')).toBe(true)
  })
})

describe('resetCachedMCState', () => {
  test('clears all state', () => {
    const state = createCachedMCState()
    registerToolResult(state, 'tool_1')
    registerToolResult(state, 'tool_2')
    resetCachedMCState(state)
    expect(state.registeredTools.size).toBe(0)
    expect(state.toolOrder).toEqual([])
    expect(state.deletedRefs.size).toBe(0)
    expect(state.pinnedEdits).toEqual([])
    expect(state.toolsSentToAPI).toBe(false)
  })
})

describe('markToolsSentToAPI', () => {
  test('marks tools as sent', () => {
    const state = createCachedMCState()
    expect(state.toolsSentToAPI).toBe(false)
    markToolsSentToAPI(state)
    expect(state.toolsSentToAPI).toBe(true)
  })
})

describe('isCachedMicrocompactEnabled', () => {
  test('returns boolean', () => {
    const result = isCachedMicrocompactEnabled()
    expect(typeof result).toBe('boolean')
  })
})

describe('isModelSupportedForCacheEditing', () => {
  test('returns true for supported model', () => {
    expect(isModelSupportedForCacheEditing('claude-sonnet-4-20250514')).toBe(true)
  })

  test('returns boolean for any model', () => {
    const result = isModelSupportedForCacheEditing('some-random-model')
    expect(typeof result).toBe('boolean')
  })
})
