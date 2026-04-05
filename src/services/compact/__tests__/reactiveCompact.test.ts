import { describe, expect, test } from 'bun:test'
import {
  isReactiveOnlyMode,
  isReactiveCompactEnabled,
  isWithheldPromptTooLong,
  isWithheldMediaSizeError,
} from '../reactiveCompact.js'

// ── Helpers ──

// AssistantMessage shape: isApiErrorMessage is at the top level
function makeAssistantMsg(options: {
  isApiErrorMessage?: boolean
  content?: string
  errorDetails?: string
}) {
  return {
    type: 'assistant' as const,
    uuid: `uuid-${Math.random()}`,
    isApiErrorMessage: options.isApiErrorMessage ?? false,
    errorDetails: options.errorDetails,
    message: {
      id: `id-${Math.random()}`,
      role: 'assistant',
      content: [
        {
          type: 'text' as const,
          text:
            options.content ?? 'normal response',
        },
      ],
    },
  }
}

function makeUserMsg() {
  return {
    type: 'user' as const,
    uuid: `uuid-${Math.random()}`,
    message: {
      role: 'user',
      content: [{ type: 'text' as const, text: 'user message' }],
    },
  }
}

// ── Tests ──

describe('isReactiveOnlyMode', () => {
  test('returns boolean', () => {
    const result = isReactiveOnlyMode()
    expect(typeof result).toBe('boolean')
  })
})

describe('isReactiveCompactEnabled', () => {
  test('returns boolean', () => {
    const result = isReactiveCompactEnabled()
    expect(typeof result).toBe('boolean')
  })
})

describe('isWithheldPromptTooLong', () => {
  test('returns true for prompt-too-long error message', () => {
    const msg = makeAssistantMsg({
      isApiErrorMessage: true,
      content: 'Prompt is too long: 200000 tokens > 190000 maximum',
      errorDetails: 'prompt is too long: 200000 tokens > 190000 maximum',
    })
    expect(isWithheldPromptTooLong(msg as any)).toBe(true)
  })

  test('returns false for normal assistant message', () => {
    const msg = makeAssistantMsg({})
    expect(isWithheldPromptTooLong(msg as any)).toBe(false)
  })

  test('returns false for user message', () => {
    const msg = makeUserMsg()
    expect(isWithheldPromptTooLong(msg as any)).toBe(false)
  })

  test('returns false for non-PTL API error', () => {
    const msg = makeAssistantMsg({
      isApiErrorMessage: true,
      content: 'API Error: rate limited',
      errorDetails: 'rate limited',
    })
    expect(isWithheldPromptTooLong(msg as any)).toBe(false)
  })
})

describe('isWithheldMediaSizeError', () => {
  test('returns true for image exceeds maximum error', () => {
    const msg = makeAssistantMsg({
      isApiErrorMessage: true,
      content: 'Image too large',
      errorDetails: 'image exceeds 5MB maximum',
    })
    expect(isWithheldMediaSizeError(msg as any)).toBe(true)
  })

  test('returns false for normal assistant message', () => {
    const msg = makeAssistantMsg({})
    expect(isWithheldMediaSizeError(msg as any)).toBe(false)
  })

  test('returns false for user message', () => {
    const msg = makeUserMsg()
    expect(isWithheldMediaSizeError(msg as any)).toBe(false)
  })
})
