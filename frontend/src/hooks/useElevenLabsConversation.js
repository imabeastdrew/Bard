/**
 * ElevenLabs Conversation Hook for Bard
 * 
 * Wraps @elevenlabs/react useConversation with Bard-specific logic:
 * - Dynamic context injection based on audiobook position
 * - Resume audiobook tool handling
 * - Auto-resume after silence timeout
 * - Conversation state management
 */

import { useConversation } from '@elevenlabs/react'
import { useCallback, useEffect, useRef, useState } from 'react'

// Conversation states
export const ConversationState = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  LISTENING: 'listening',
  SPEAKING: 'speaking',
  DISCONNECTING: 'disconnecting',
}

/**
 * Custom hook for ElevenLabs Conversational AI integration
 * 
 * @param {Object} options
 * @param {string} options.agentId - ElevenLabs agent ID
 * @param {number} options.timeoutMs - Auto-resume timeout in milliseconds
 * @param {Function} options.onResumeAudiobook - Callback when audiobook should resume
 * @param {Function} options.getContext - Function to get current audiobook context
 * @param {Function} options.onError - Error handler callback
 */
export function useElevenLabsConversation({
  agentId,
  timeoutMs = 10000,
  onResumeAudiobook,
  getContext,
  onError,
}) {
  const [conversationState, setConversationState] = useState(ConversationState.IDLE)
  const [silenceCountdown, setSilenceCountdown] = useState(null)
  const [lastMessage, setLastMessage] = useState(null)
  const silenceTimerRef = useRef(null)
  const isConnectedRef = useRef(false)

  // Clear silence timer
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    setSilenceCountdown(null)
  }, [])

  // Start silence countdown timer
  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer()
    
    // Update countdown every second
    let remaining = Math.ceil(timeoutMs / 1000)
    setSilenceCountdown(remaining)
    
    const countdownInterval = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setSilenceCountdown(remaining)
      } else {
        clearInterval(countdownInterval)
      }
    }, 1000)

    silenceTimerRef.current = setTimeout(() => {
      clearInterval(countdownInterval)
      console.log('[Conversation] Silence timeout - resuming audiobook')
      handleResume()
    }, timeoutMs)
  }, [timeoutMs, clearSilenceTimer])

  // Handle resume (from tool call or timeout)
  const handleResume = useCallback(async () => {
    console.log('[Conversation] Resuming audiobook...')
    clearSilenceTimer()
    
    // End the conversation session
    if (isConnectedRef.current) {
      try {
        await conversation.endSession()
      } catch (e) {
        console.warn('[Conversation] Error ending session:', e)
      }
    }
    
    // Notify parent to resume audiobook
    onResumeAudiobook?.()
  }, [clearSilenceTimer, onResumeAudiobook])

  // Initialize ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('[Conversation] Connected to agent')
      isConnectedRef.current = true
      setConversationState(ConversationState.LISTENING)
      
      // Send initial context
      if (getContext) {
        const context = getContext()
        if (context) {
          console.log('[Conversation] Sending initial context:', context.substring(0, 100) + '...')
          conversation.sendContextualUpdate(context)
        }
      }
    },
    
    onDisconnect: () => {
      console.log('[Conversation] Disconnected')
      isConnectedRef.current = false
      setConversationState(ConversationState.IDLE)
      clearSilenceTimer()
    },
    
    onMessage: (message) => {
      console.log('[Conversation] Message:', message)
      setLastMessage(message)
      
      // Reset silence timer on any message activity
      if (conversationState === ConversationState.LISTENING) {
        clearSilenceTimer()
      }
    },
    
    onModeChange: (mode) => {
      console.log('[Conversation] Mode changed:', mode)
      
      if (mode.mode === 'speaking') {
        setConversationState(ConversationState.SPEAKING)
        clearSilenceTimer()
      } else if (mode.mode === 'listening') {
        setConversationState(ConversationState.LISTENING)
        // Start silence timer when agent stops speaking and starts listening
        startSilenceTimer()
      }
    },
    
    onError: (error) => {
      console.error('[Conversation] Error:', error)
      setConversationState(ConversationState.IDLE)
      clearSilenceTimer()
      onError?.(error)
    },
    
    onInterruption: () => {
      console.log('[Conversation] User interrupted')
      clearSilenceTimer()
    },
    
    // Client tools that the agent can invoke
    clientTools: {
      resume_audiobook: async () => {
        console.log('[Conversation] Agent invoked resume_audiobook tool')
        await handleResume()
        return { success: true }
      },
    },
  })

  // Start a conversation session
  const startConversation = useCallback(async () => {
    if (!agentId) {
      console.error('[Conversation] No agent ID configured')
      onError?.(new Error('No agent ID configured'))
      return
    }

    try {
      console.log('[Conversation] Starting session with agent:', agentId)
      setConversationState(ConversationState.CONNECTING)
      
      const conversationId = await conversation.startSession({ agentId })
      console.log('[Conversation] Session started:', conversationId)
      
      return conversationId
    } catch (error) {
      console.error('[Conversation] Failed to start session:', error)
      setConversationState(ConversationState.IDLE)
      onError?.(error)
      throw error
    }
  }, [agentId, conversation, onError])

  // End conversation and resume audiobook
  const endConversation = useCallback(async () => {
    await handleResume()
  }, [handleResume])

  // Send contextual update to the agent
  const updateContext = useCallback((context) => {
    if (isConnectedRef.current) {
      console.log('[Conversation] Updating context')
      conversation.sendContextualUpdate(context)
    }
  }, [conversation])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer()
      if (isConnectedRef.current) {
        conversation.endSession().catch(() => {})
      }
    }
  }, [])

  return {
    // State
    conversationState,
    silenceCountdown,
    lastMessage,
    isConnected: isConnectedRef.current,
    
    // Actions
    startConversation,
    endConversation,
    updateContext,
    
    // Direct conversation access (for advanced use)
    conversation,
  }
}

export default useElevenLabsConversation


