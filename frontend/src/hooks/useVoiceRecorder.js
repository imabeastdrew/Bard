import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Voice Activity Detection (VAD) based voice recorder hook.
 * Records audio and automatically stops after detecting silence.
 * 
 * @param {Object} options
 * @param {number} options.silenceThreshold - Volume threshold below which is considered silence (0-1)
 * @param {number} options.silenceDuration - Duration of silence (ms) before stopping
 * @param {function} options.onRecordingComplete - Callback when recording completes with audio blob
 * @param {function} options.onError - Callback when an error occurs
 */
export default function useVoiceRecorder({
  silenceThreshold = 0.01,
  silenceDuration = 1500,
  onRecordingComplete,
  onError,
} = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState(null)
  
  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const silenceStartRef = useRef(null)
  const animationFrameRef = useRef(null)
  const hasSpokenRef = useRef(false)
  const isRecordingRef = useRef(false)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    analyserRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
    silenceStartRef.current = null
    hasSpokenRef.current = false
    isRecordingRef.current = false
    setAudioLevel(0)
  }, [])

  // Stop recording - defined early so it can be used by analyzeAudio
  const stopRecording = useCallback(() => {
    console.log('[VAD] stopRecording called')
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // Analyze audio levels for VAD
  const analyzeAudio = useCallback(() => {
    // Check if we should still be recording
    if (!analyserRef.current || !isRecordingRef.current) {
      console.log('[VAD] analyzeAudio skipped:', { 
        hasAnalyser: !!analyserRef.current, 
        isRecording: isRecordingRef.current 
      })
      return
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average volume (0-1 range)
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const normalizedVolume = average / 255
    setAudioLevel(normalizedVolume)
    
    // Log periodically (every ~30 frames = ~0.5s)
    if (Math.random() < 0.03) {
      console.log('[VAD] Audio level:', normalizedVolume.toFixed(3), 'hasSpoken:', hasSpokenRef.current)
    }

    // Voice Activity Detection
    if (normalizedVolume > silenceThreshold) {
      // User is speaking
      silenceStartRef.current = null
      hasSpokenRef.current = true
    } else if (hasSpokenRef.current) {
      // Potential silence after speech
      if (!silenceStartRef.current) {
        silenceStartRef.current = Date.now()
      } else if (Date.now() - silenceStartRef.current > silenceDuration) {
        // Silence duration exceeded - stop recording
        console.log('[VAD] Silence detected, stopping recording')
        stopRecording()
        return
      }
    }

    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }, [silenceThreshold, silenceDuration, stopRecording])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      cleanup()

      console.log('[VAD] Requesting microphone access...')
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      })
      streamRef.current = stream
      console.log('[VAD] Microphone access granted')

      // Set up audio analysis for VAD
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

      console.log('[VAD] Using mimeType:', mimeType)
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        console.log('[VAD] Recording stopped, hasSpoken:', hasSpokenRef.current, 'chunks:', chunksRef.current.length)
        const audioBlob = new Blob(chunksRef.current, { type: mimeType })
        console.log('[VAD] Audio blob size:', audioBlob.size)
        isRecordingRef.current = false
        setIsRecording(false)
        setIsListening(false)
        
        if (audioBlob.size > 0 && hasSpokenRef.current) {
          console.log('[VAD] Calling onRecordingComplete with blob')
          onRecordingComplete?.(audioBlob)
        } else {
          console.log('[VAD] Not calling onRecordingComplete - blob empty or no speech detected')
        }
        
        cleanup()
      }

      mediaRecorderRef.current.onerror = (event) => {
        console.error('[VAD] MediaRecorder error:', event)
        const errorMsg = 'Recording error occurred'
        setError(errorMsg)
        onError?.(errorMsg)
        cleanup()
      }

      // Start recording
      mediaRecorderRef.current.start(100) // Collect data every 100ms
      isRecordingRef.current = true
      setIsRecording(true)
      setIsListening(true)
      hasSpokenRef.current = false
      silenceStartRef.current = null

      console.log('[VAD] Recording started, starting audio analysis...')
      // Start audio analysis loop
      analyzeAudio()

    } catch (err) {
      console.error('[VAD] Error starting recording:', err)
      let errorMsg = 'Failed to access microphone'
      
      if (err.name === 'NotAllowedError') {
        errorMsg = 'Microphone access denied. Please allow microphone access and try again.'
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'No microphone found. Please connect a microphone and try again.'
      } else if (err.name === 'NotReadableError') {
        errorMsg = 'Microphone is in use by another application.'
      }
      
      setError(errorMsg)
      onError?.(errorMsg)
      cleanup()
    }
  }, [cleanup, analyzeAudio, onRecordingComplete, onError])

  // Cancel recording (discard audio)
  const cancelRecording = useCallback(() => {
    console.log('[VAD] Canceling recording')
    hasSpokenRef.current = false // Prevent callback
    chunksRef.current = []
    isRecordingRef.current = false
    stopRecording()
    cleanup()
    setIsRecording(false)
    setIsListening(false)
  }, [stopRecording, cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // Handle Escape key to cancel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isRecording) {
        cancelRecording()
      }
    }

    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isRecording, cancelRecording])

  return {
    isRecording,
    isListening,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
