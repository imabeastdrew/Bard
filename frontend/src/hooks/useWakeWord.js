import { useEffect, useCallback, useRef } from 'react'
import { usePorcupine } from '@picovoice/porcupine-react'

/**
 * Wake word detection hook using Picovoice Porcupine.
 * Listens for "Hey Bard" and triggers a callback when detected.
 * 
 * @param {Object} options
 * @param {boolean} options.enabled - Whether wake word detection should be active
 * @param {function} options.onWakeWord - Callback when "Hey Bard" is detected
 */
export default function useWakeWord({
  enabled = false,
  onWakeWord,
} = {}) {
  const accessKey = import.meta.env.VITE_PICOVOICE_ACCESS_KEY
  const onWakeWordRef = useRef(onWakeWord)
  
  // Keep callback ref up to date
  useEffect(() => {
    onWakeWordRef.current = onWakeWord
  }, [onWakeWord])

  const {
    keywordDetection,
    isLoaded,
    isListening,
    error,
    init,
    start,
    stop,
    release,
  } = usePorcupine()

  // Initialize Porcupine
  const initialize = useCallback(async () => {
    if (!accessKey) {
      console.warn('[WakeWord] No access key found. Set VITE_PICOVOICE_ACCESS_KEY in .env')
      return false
    }

    try {
      console.log('[WakeWord] Initializing Porcupine...')
      
      // Custom keyword model
      const keywordModel = {
        publicPath: '/porcupine/Hey-Bard_en_wasm_v4_0_0.ppn',
        label: 'Hey Bard',
      }
      
      // Base Porcupine model
      const porcupineModel = {
        publicPath: '/porcupine/porcupine_params.pv',
      }

      await init(
        accessKey,
        [keywordModel],
        porcupineModel
      )
      
      console.log('[WakeWord] Porcupine initialized successfully')
      return true
    } catch (err) {
      console.error('[WakeWord] Failed to initialize:', err)
      return false
    }
  }, [accessKey, init])

  // Initialize on mount
  useEffect(() => {
    console.log('[WakeWord] Hook mounted, accessKey present:', !!accessKey)
    
    if (accessKey) {
      initialize()
    } else {
      console.warn('[WakeWord] No access key found. Create frontend/.env with VITE_PICOVOICE_ACCESS_KEY=your_key')
    }
    
    return () => {
      release()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Start/stop listening based on enabled prop
  useEffect(() => {
    if (!isLoaded) return

    if (enabled && !isListening) {
      console.log('[WakeWord] Starting wake word detection...')
      start().catch(err => {
        console.error('[WakeWord] Failed to start:', err)
      })
    } else if (!enabled && isListening) {
      console.log('[WakeWord] Stopping wake word detection...')
      stop().catch(err => {
        console.error('[WakeWord] Failed to stop:', err)
      })
    }
  }, [enabled, isLoaded, isListening, start, stop])

  // Handle wake word detection
  useEffect(() => {
    if (keywordDetection !== null) {
      console.log('[WakeWord] Detected:', keywordDetection.label)
      onWakeWordRef.current?.()
    }
  }, [keywordDetection])

  return {
    isLoaded,
    isListening,
    error,
    // For debugging
    hasAccessKey: !!accessKey,
  }
}

