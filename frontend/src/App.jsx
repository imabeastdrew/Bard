import { useState, useEffect, useRef, useCallback } from 'react'
import AudioPlayer from './components/AudioPlayer'
import ChapterSidebar from './components/ChapterSidebar'
import CurrentSentence from './components/CurrentSentence'
import Header from './components/Header'
import useVoiceRecorder from './hooks/useVoiceRecorder'
import useWakeWord from './hooks/useWakeWord'

function App() {
  const [chapters, setChapters] = useState([])
  const [currentChapter, setCurrentChapter] = useState(null)
  const [alignment, setAlignment] = useState([])
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Ask Bard state machine
  // null | 'listening' | 'transcribing' | 'preview' | 'thinking' | 'answer'
  const [askState, setAskState] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [answer, setAnswer] = useState('')
  const [answerAudioUrl, setAnswerAudioUrl] = useState(null)
  const [askError, setAskError] = useState(null)
  
  const audioRef = useRef(null)
  const answerAudioRef = useRef(null)
  const pausedTimeRef = useRef(0)
  const previewTimeoutRef = useRef(null)
  
  // Performance timing refs
  const timingRef = useRef({
    t0_recordingComplete: null,  // Audio capture done
    t1_transcriptionDone: null,  // Transcription response received
    t2_previewTimeout: null,     // Preview timeout fires
    t3_askResponseDone: null,    // /ask response received
    t4_audioPlaying: null,       // Answer audio starts playing
  })

  // Voice recorder hook
  const {
    audioLevel,
    startRecording,
    cancelRecording,
  } = useVoiceRecorder({
    silenceThreshold: 0.2, 
    silenceDuration: 1500,
    onRecordingComplete: handleRecordingComplete,
    onError: handleRecordingError,
  })

  // Wake word callback - triggers Ask Bard flow
  const handleWakeWord = useCallback(() => {
    // Only trigger if not already in Q&A flow and alignment is ready
    if (askState === null && alignment.length > 0) {
      console.log('[App] Wake word detected! Starting Ask Bard flow...')
      // Clear any previous state
      setAskError(null)
      setTranscript('')
      setAnswer('')
      setAnswerAudioUrl(null)
      
      // Pause audio
      if (audioRef.current) {
        audioRef.current.pause()
        pausedTimeRef.current = audioRef.current.currentTime
      }
      setIsPlaying(false)
      
      // Start listening
      setAskState('listening')
      startRecording()
    }
  }, [askState, alignment.length, startRecording])

  // Wake word detection - active when audiobook is playing and not in Q&A
  const {
    isLoaded: wakeWordLoaded,
    isListening: wakeWordListening,
    error: wakeWordError,
    hasAccessKey: wakeWordHasKey,
  } = useWakeWord({
    enabled: isPlaying && askState === null,
    onWakeWord: handleWakeWord,
  })

  // Handle completed voice recording
  async function handleRecordingComplete(audioBlob) {
    // T0: Recording complete - start timing
    timingRef.current.t0_recordingComplete = performance.now()
    console.log('[Timing] T0 - Recording complete, starting pipeline...')
    
    setAskState('transcribing')
    console.log('[App] Transcribing audio, size:', audioBlob.size)
    
    try {
      // Transcribe the audio
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      
      const transcribeRes = await fetch('/transcribe', {
        method: 'POST',
        body: formData,
      })
      
      if (!transcribeRes.ok) {
        const errorText = await transcribeRes.text()
        throw new Error(errorText || 'Transcription failed')
      }
      
      const transcribeData = await transcribeRes.json()
      
      // T1: Transcription done
      timingRef.current.t1_transcriptionDone = performance.now()
      const transcriptionLatency = timingRef.current.t1_transcriptionDone - timingRef.current.t0_recordingComplete
      console.log(`[Timing] T1 - Transcription done: ${transcriptionLatency.toFixed(0)}ms`)
      if (transcribeData.timing) {
        console.log(`[Timing] Backend transcription breakdown:`, transcribeData.timing)
      }
      
      if (!transcribeData.text || transcribeData.text.trim().length === 0) {
        throw new Error('No speech detected. Please try again.')
      }
      
      const transcribedText = transcribeData.text
      console.log('[App] Transcript:', transcribedText)
      setTranscript(transcribedText)
      
      // Skip preview - send immediately for lower latency
      // T2: Immediate (no preview delay)
      timingRef.current.t2_previewTimeout = performance.now()
      console.log(`[Timing] T2 - Skipping preview, sending immediately`)
      sendQuestion(transcribedText)
      
    } catch (err) {
      console.error('[App] Transcription error:', err)
      setAskError(err.message)
      setAskState(null)
      resumePlayback()
    }
  }

  // Send question to Bard
  async function sendQuestion(questionText) {
    setAskState('thinking')
    console.log('[App] Sending question:', questionText)
    
    try {
      const askRes = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          chapter_id: currentChapter?.chapter_id,
          audio_time: pausedTimeRef.current,
        }),
      })
      
      if (!askRes.ok) {
        const errorData = await askRes.json()
        throw new Error(errorData.detail || 'Failed to get answer')
      }
      
      const askData = await askRes.json()
      
      // T3: Ask response received
      timingRef.current.t3_askResponseDone = performance.now()
      const askLatency = timingRef.current.t3_askResponseDone - timingRef.current.t2_previewTimeout
      const totalSoFar = timingRef.current.t3_askResponseDone - timingRef.current.t0_recordingComplete
      console.log(`[Timing] T3 - Ask response received: ${askLatency.toFixed(0)}ms (total so far: ${totalSoFar.toFixed(0)}ms)`)
      if (askData.timing) {
        console.log(`[Timing] Backend /ask breakdown:`, askData.timing)
      }
      
      console.log('[App] Answer received:', askData.answer?.substring(0, 50) + '...')
      
      setAnswer(askData.answer)
      setAnswerAudioUrl(askData.audio_url)
      setAskState('answer')
      
      // Auto-play answer audio if available
      if (askData.audio_url && answerAudioRef.current) {
        answerAudioRef.current.src = askData.audio_url
        
        // Add event listener for when audio starts playing
        const handlePlay = () => {
          // T4: Audio starts playing
          timingRef.current.t4_audioPlaying = performance.now()
          const audioLoadTime = timingRef.current.t4_audioPlaying - timingRef.current.t3_askResponseDone
          const totalLatency = timingRef.current.t4_audioPlaying - timingRef.current.t0_recordingComplete
          
          console.log(`[Timing] T4 - Audio playing: ${audioLoadTime.toFixed(0)}ms load time`)
          console.log(`[Timing] ═══════════════════════════════════════════════════`)
          console.log(`[Timing] TOTAL LATENCY: ${totalLatency.toFixed(0)}ms (${(totalLatency/1000).toFixed(2)}s)`)
          console.log(`[Timing] Breakdown:`)
          console.log(`[Timing]   • Transcription:  ${(timingRef.current.t1_transcriptionDone - timingRef.current.t0_recordingComplete).toFixed(0)}ms`)
          console.log(`[Timing]   • Preview delay:  ${(timingRef.current.t2_previewTimeout - timingRef.current.t1_transcriptionDone).toFixed(0)}ms`)
          console.log(`[Timing]   • Ask (LLM+TTS):  ${(timingRef.current.t3_askResponseDone - timingRef.current.t2_previewTimeout).toFixed(0)}ms`)
          console.log(`[Timing]   • Audio load:     ${audioLoadTime.toFixed(0)}ms`)
          console.log(`[Timing] ═══════════════════════════════════════════════════`)
          
          answerAudioRef.current.removeEventListener('play', handlePlay)
        }
        
        answerAudioRef.current.addEventListener('play', handlePlay)
        answerAudioRef.current.play().catch(err => {
          console.warn('[App] Answer audio autoplay blocked:', err)
        })
      }
      
    } catch (err) {
      console.error('[App] Ask error:', err)
      setAskError(err.message)
      setAskState(null)
      resumePlayback()
    }
  }

  // Handle recording error
  function handleRecordingError(errorMsg) {
    console.error('[App] Recording error:', errorMsg)
    setAskError(errorMsg)
    setAskState(null)
    resumePlayback()
  }

  // Resume playback after Q&A
  function resumePlayback() {
    if (audioRef.current) {
      audioRef.current.currentTime = pausedTimeRef.current
      audioRef.current.play().catch(err => {
        console.warn('[App] Resume playback blocked:', err)
      })
      setIsPlaying(true)
    }
  }

  // Handle answer audio ended - auto-resume narration
  function handleAnswerAudioEnded() {
    console.log('[App] Answer audio ended, resuming narration')
    setAskState(null)
    setTranscript('')
    setAnswer('')
    setAnswerAudioUrl(null)
    resumePlayback()
  }

  // Fetch chapters on mount
  useEffect(() => {
    fetch('/chapters')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load chapters')
        return res.json()
      })
      .then(data => {
        setChapters(data)
        if (data.length > 0) {
          setCurrentChapter(data[0])
        }
        setIsLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setIsLoading(false)
      })
  }, [])

  // Fetch alignment when chapter changes
  useEffect(() => {
    if (!currentChapter) return
    
    fetch(`/chapters/${currentChapter.chapter_id}/alignment`)
      .then(res => {
        if (!res.ok) throw new Error('Alignment not available')
        return res.json()
      })
      .then(setAlignment)
      .catch(err => {
        console.warn('Alignment not available:', err)
        setAlignment([])
      })
  }, [currentChapter])

  // Cleanup preview timeout
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
      }
    }
  }, [])

  // Find current sentence based on time
  const currentSentence = alignment.find(
    s => currentTime >= s.start_time && currentTime <= s.end_time
  )

  const handleChapterChange = useCallback((chapter) => {
    setCurrentChapter(chapter)
    setCurrentTime(0)
    if (audioRef.current) {
      audioRef.current.currentTime = 0
    }
  }, [])

  const handleTimeUpdate = useCallback((time) => {
    setCurrentTime(time)
  }, [])

  const handlePlayStateChange = useCallback((playing) => {
    setIsPlaying(playing)
  }, [])

  // Cancel the Ask Bard flow
  const handleCancelAsk = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
    }
    cancelRecording()
    setAskState(null)
    setTranscript('')
    setAnswer('')
    setAskError(null)
    resumePlayback()
  }, [cancelRecording])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev)
  }, [])

  // Determine mic indicator state
  const micIsActive = wakeWordListening && wakeWordLoaded && !wakeWordError

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-ink-400 font-serif text-lg">Loading Bard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <h2 className="font-display text-2xl text-parchment-100 mb-4">Connection Error</h2>
          <p className="text-ink-400 mb-4">{error}</p>
          <p className="text-ink-500 text-sm">Make sure the backend server is running.</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-secondary mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        onToggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
      />
      
      {/* Sidebar */}
      <ChapterSidebar
        chapters={chapters}
        currentChapter={currentChapter}
        onChapterChange={handleChapterChange}
        isOpen={isSidebarOpen}
      />
      
      {/* Main content - shifts when sidebar is open */}
      <main className={`
        flex-1 transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'ml-72' : 'ml-0'}
      `}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          
          {/* Mic Indicator - centered above player */}
          <div className="flex justify-center mb-6">
            <div 
              className={`
                transition-all duration-300
                ${micIsActive ? 'mic-glow-pulse' : ''}
              `}
              title={
                wakeWordError 
                  ? `Error: ${wakeWordError}` 
                  : micIsActive 
                    ? 'Listening for "Hey Bard"' 
                    : 'Mic inactive'
              }
            >
              <svg 
                className={`w-12 h-12 transition-colors duration-300 ${
                  micIsActive ? 'text-gold-500' : 'text-ink-500'
                }`}
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            </div>
          </div>

          {/* Audio Player */}
          {currentChapter && (
            <section className="card p-6 mb-8">
              <AudioPlayer
                ref={audioRef}
                chapterId={currentChapter.chapter_id}
                chapterTitle={currentChapter.title}
                duration={currentChapter.duration_seconds}
                onTimeUpdate={handleTimeUpdate}
                onPlayStateChange={handlePlayStateChange}
              />
            </section>
          )}

          {/* Current Sentence / Ask Bard Display */}
          <section className="mb-8">
            <CurrentSentence 
              sentence={currentSentence}
              askState={askState}
              audioLevel={audioLevel}
              transcript={transcript}
              answer={answer}
              askError={askError}
              onCancel={handleCancelAsk}
            />
          </section>
        </div>
      </main>

      {/* Hidden audio element for answer playback */}
      <audio 
        ref={answerAudioRef}
        onEnded={handleAnswerAudioEnded}
        className="hidden"
      />

    </div>
  )
}

export default App
