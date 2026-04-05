import { describe, expect, test } from 'bun:test'
import {
  isSnipBoundaryMessage,
  projectSnippedView,
} from '../snipProjection.js'
import {
  isSnipMarkerMessage,
  type SnipCompactResult,
} from '../snipCompact.js'

// ── Helpers ──

function makeMsg(
  type: 'user' | 'assistant' | 'system',
  overrides: Record<string, unknown> = {},
) {
  return {
    type,
    message: { id: `id-${Math.random()}`, content: `${type}-content` },
    ...overrides,
  }
}

function makeAssistantMsg(id: string) {
  return makeMsg('assistant', {
    message: { id, content: [{ type: 'text', text: `assistant-${id}` }] },
  })
}

function makeUserMsg() {
  return makeMsg('user', {
    message: { content: [{ type: 'text', text: 'user-content' }] },
  })
}

function makeSnipBoundaryMsg() {
  return makeMsg('system', {
    subtype: 'snip_boundary',
    content: 'History snipped: 3 round(s) removed (~5000 tokens freed)',
  })
}

function makeSnipMarkerMsg() {
  return makeMsg('system', {
    subtype: 'snip_marker',
    content: 'Internal snip marker',
  })
}

// ── snipProjection Tests ──

describe('isSnipBoundaryMessage', () => {
  test('returns true for snip boundary message', () => {
    const msg = makeSnipBoundaryMsg()
    expect(isSnipBoundaryMessage(msg as any)).toBe(true)
  })

  test('returns false for regular system message', () => {
    const msg = makeMsg('system', { content: 'normal system message' })
    expect(isSnipBoundaryMessage(msg as any)).toBe(false)
  })

  test('returns false for user message', () => {
    const msg = makeUserMsg()
    expect(isSnipBoundaryMessage(msg as any)).toBe(false)
  })

  test('returns false for assistant message', () => {
    const msg = makeAssistantMsg('a1')
    expect(isSnipBoundaryMessage(msg as any)).toBe(false)
  })
})

describe('projectSnippedView', () => {
  test('returns messages unchanged when no snip boundary', () => {
    const messages = [
      makeAssistantMsg('a1'),
      makeUserMsg(),
      makeAssistantMsg('a2'),
    ]
    const result = projectSnippedView(messages as any[])
    expect(result).toEqual(messages)
  })

  test('truncates messages before snip boundary', () => {
    const boundary = makeSnipBoundaryMsg()
    const messages = [
      makeAssistantMsg('a1'), // will be snipped
      makeUserMsg(),          // will be snipped
      boundary,               // kept
      makeAssistantMsg('a2'), // kept
      makeUserMsg(),          // kept
    ]
    const result = projectSnippedView(messages as any[])
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(boundary)
  })

  test('handles empty messages', () => {
    expect(projectSnippedView([])).toEqual([])
  })

  test('handles boundary at start', () => {
    const boundary = makeSnipBoundaryMsg()
    const messages = [boundary, makeAssistantMsg('a1'), makeUserMsg()]
    const result = projectSnippedView(messages as any[])
    expect(result).toEqual(messages)
  })

  test('handles boundary at end', () => {
    const boundary = makeSnipBoundaryMsg()
    const messages = [makeAssistantMsg('a1'), makeUserMsg(), boundary]
    const result = projectSnippedView(messages as any[])
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(boundary)
  })
})

// ── snipCompact Tests ──

describe('isSnipMarkerMessage', () => {
  test('returns true for snip marker message', () => {
    const msg = makeSnipMarkerMsg()
    expect(isSnipMarkerMessage(msg as any)).toBe(true)
  })

  test('returns false for snip boundary message', () => {
    const msg = makeSnipBoundaryMsg()
    expect(isSnipMarkerMessage(msg as any)).toBe(false)
  })

  test('returns false for regular system message', () => {
    const msg = makeMsg('system', { content: 'normal' })
    expect(isSnipMarkerMessage(msg as any)).toBe(false)
  })

  test('returns false for user message', () => {
    const msg = makeUserMsg()
    expect(isSnipMarkerMessage(msg as any)).toBe(false)
  })
})
