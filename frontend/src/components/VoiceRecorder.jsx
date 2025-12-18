import { useState, useEffect, useCallback } from 'react'
import useVoiceRecorder from '../hooks/useVoiceRecorder'

/**
 * Voice recorder component with visual feedback and automatic silence detection.
 * 
 * States:
 * - idle: Not recording, waiting to start
 * - listening: Recording audio, showing level meter
 * - transcribing: Sending audio to backend for transcription
 * - preview: Showing transcribed text briefly before sending
 * - error: An error occurred
 */
export default function VoiceRecorder({ 
  onTranscriptionComplete,
  onCancel,
  onError,
  disabled = false,
}) {
  const [state, setState] = useState('idle') // idle | listening | transcribing | preview | error
  const [transcript, setTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [previewCountdown, setPreviewCountdown] = useState(0)

  const handleRecordingComplete = useCallback(async (audioBlob) => {
    setState('transcribing')
    console.log('[VoiceRecorder] Sending audio for transcription, size:', audioBlob.size)
    
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/transcribe', {
        method: 'POST',
        body: formData,
      })

      console.log('[VoiceRecorder] Response status:', response.status)
      
      // Get response text first
      const responseText = await response.text()
      console.log('[VoiceRecorder] Response body:', responseText)
      
      if (!response.ok) {
        let errorMsg = 'Transcription failed'
        try {
          const errorData = JSON.parse(responseText)
          errorMsg = errorData.detail || errorMsg
        } catch {
          errorMsg = responseText || errorMsg
        }
        throw new Error(errorMsg)
      }

      // Parse the successful response
      const data = JSON.parse(responseText)
      
      if (!data.text || data.text.trim().length === 0) {
        throw new Error('No speech detected. Please try again.')
      }

      console.log('[VoiceRecorder] Transcription:', data.text)
      setTranscript(data.text)
      setState('preview')
      setPreviewCountdown(1.5)

    } catch (err) {
      console.error('[VoiceRecorder] Error:', err)
      setErrorMessage(err.message)
      setState('error')
      onError?.(err.message)
    }
  }, [onError])

  const handleRecorderError = useCallback((error) => {
    setErrorMessage(error)
    setState('error')
    onError?.(error)
  }, [onError])

  const {
    isRecording,
    isListening,
    audioLevel,
    error: recorderError,
    startRecording,
    cancelRecording,
  } = useVoiceRecorder({
    silenceThreshold: 0.015,
    silenceDuration: 1500,
    onRecordingComplete: handleRecordingComplete,
    onError: handleRecorderError,
  })

  // Handle preview countdown and auto-send
  useEffect(() => {
    if (state !== 'preview') return

    if (previewCountdown <= 0) {
      onTranscriptionComplete?.(transcript)
      return
    }

    const timer = setTimeout(() => {
      setPreviewCountdown(prev => Math.max(0, prev - 0.1))
    }, 100)

    return () => clearTimeout(timer)
  }, [state, previewCountdown, transcript, onTranscriptionComplete])

  // Start recording on mount
  useEffect(() => {
    if (state === 'idle' && !disabled) {
      startRecording()
      setState('listening')
    }
  }, [state, disabled, startRecording])

  // Sync recorder error
  useEffect(() => {
    if (recorderError && state === 'listening') {
      setErrorMessage(recorderError)
      setState('error')
    }
  }, [recorderError, state])

  const handleCancel = () => {
    cancelRecording()
    setState('idle')
    onCancel?.()
  }

  const handleRetry = () => {
    setErrorMessage('')
    setState('idle')
  }

  // Render based on state
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-red-600 text-center">{errorMessage}</p>
        <div className="flex gap-3">
          <button onClick={handleCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleRetry} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (state === 'transcribing') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-16 h-16 bg-ink-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-ink-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-ink-600 font-medium">Transcribing...</p>
      </div>
    )
  }

  if (state === 'preview') {
    const progressPercent = (previewCountdown / 1.5) * 100
    
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-full p-4 bg-parchment-200/50 rounded-lg border border-parchment-300">
          <p className="text-ink-500 text-xs uppercase tracking-wider mb-2">You asked:</p>
          <p className="text-ink-800 font-serif text-lg">"{transcript}"</p>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-1 bg-ink-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gold-500 transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        <p className="text-ink-500 text-sm">Sending in {previewCountdown.toFixed(1)}s...</p>
      </div>
    )
  }

  // Listening state (default)
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Pulsing microphone indicator */}
      <div className="relative">
        <div 
          className="absolute inset-0 bg-red-500/30 rounded-full animate-ping"
          style={{ animationDuration: '1.5s' }}
        />
        <div 
          className="relative w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg"
          style={{
            transform: `scale(${1 + audioLevel * 0.3})`,
            transition: 'transform 0.1s ease-out',
          }}
        >
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        </div>
      </div>

      <p className="text-ink-700 font-medium text-lg">Listening...</p>
      <p className="text-ink-500 text-sm">Speak your question</p>

      {/* Audio level meter */}
      <div className="flex items-center gap-1 h-8">
        {[...Array(12)].map((_, i) => {
          const threshold = i / 12
          const isActive = audioLevel > threshold
          return (
            <div
              key={i}
              className={`w-2 rounded-full transition-all duration-75 ${
                isActive 
                  ? i < 4 ? 'bg-green-500' : i < 8 ? 'bg-yellow-500' : 'bg-red-500'
                  : 'bg-ink-200'
              }`}
              style={{ 
                height: `${12 + i * 2}px`,
              }}
            />
          )
        })}
      </div>

      <button
        onClick={handleCancel}
        className="mt-2 text-ink-500 hover:text-ink-700 text-sm flex items-center gap-1 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Cancel (Esc)
      </button>
    </div>
  )
}

