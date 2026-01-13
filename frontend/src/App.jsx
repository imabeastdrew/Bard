import { useState, useEffect, useRef, useCallback } from 'react'
import AudioPlayer from './components/AudioPlayer'
import ChapterSidebar from './components/ChapterSidebar'
import CurrentSentence from './components/CurrentSentence'
import Header from './components/Header'
import useVoiceRecorder from './hooks/useVoiceRecorder'
import useWakeWord from './hooks/useWakeWord'
import { useElevenLabsConversation, ConversationState } from './hooks/useElevenLabsConversation'

function App() {
  const [chapters, setChapters] = useState([])
  const [currentChapter, setCurrentChapter] = useState(null)
  const [alignment, setAlignment] = useState([])
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Agent configuration
  const [agentConfig, setAgentConfig] = useState(null)
  const [useAgent, setUseAgent] = useState(true) // Feature flag
  
  // Ask Bard state machine (legacy + new)
  // null | 'listening' | 'transcribing' | 'preview' | 'thinking' | 'answer' | 'conversation'
  const [askState, setAskState] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [answer, setAnswer] = useState('')
  const [answerAudioUrl, setAnswerAudioUrl] = useState(null)
  const [askError, setAskError] = useState(null)
  
  const audioRef = useRef(null)
  const answerAudioRef = useRef(null)
  const pausedTimeRef = useRef(0)
  const previewTimeoutRef = useRef(null)
  
  // Performance timing refs (legacy)
  const timingRef = useRef({
    t0_recordingComplete: null,
    t1_transcriptionDone: null,
    t2_previewTimeout: null,
    t3_askResponseDone: null,
    t4_audioPlaying: null,
  })

  // Get context for conversation
  const getContext = useCallback(() => {
    if (!currentChapter || !alignment.length) return null
    
    // Find current sentence
    const currentSentence = alignment.find(
      s => pausedTimeRef.current >= s.start_time && pausedTimeRef.current <= s.end_time
    )
    
    // Get text heard so far (up to max words)
    const maxWords = agentConfig?.max_context_words || 2000
    const sentencesHeard = alignment.filter(s => s.end_time <= pausedTimeRef.current)
    let textHeard = sentencesHeard.map(s => s.text).join(' ')
    
    // Truncate to max words (from the end, keeping recent context)
    const words = textHeard.split(/\s+/)
    if (words.length > maxWords) {
      textHeard = '...' + words.slice(-maxWords).join(' ')
    }
    
    return `Current position: Chapter ${currentChapter.chapter_id}, "${currentChapter.title}"
${currentSentence ? `Current sentence: "${currentSentence.text}"` : ''}
    
Text heard so far (${words.length} words):
${textHeard}`
  }, [currentChapter, alignment, agentConfig])

  // Resume playback after conversation
  const resumePlayback = useCallback(() => {
    console.log('[App] Resuming playback from', pausedTimeRef.current)
    if (audioRef.current) {
      audioRef.current.currentTime = pausedTimeRef.current
      audioRef.current.play().catch(err => {
        console.warn('[App] Resume playback blocked:', err)
      })
      setIsPlaying(true)
    }
    // Clear conversation state
    setAskState(null)
    setTranscript('')
    setAnswer('')
    setAskError(null)
    setAnswerAudioUrl(null)
  }, [])

  // ElevenLabs Conversation hook
  const {
    conversationState,
    silenceCountdown,
    startConversation,
    endConversation,
  } = useElevenLabsConversation({
    agentId: agentConfig?.agent_id,
    timeoutMs: agentConfig?.conversation_timeout_ms || 10000,
    onResumeAudiobook: resumePlayback,
    getContext,
    onError: (err) => {
      console.error('[App] Conversation error:', err)
      setAskError(err.message || 'Conversation error')
      setAskState(null)
      resumePlayback()
    },
  })

  // Voice recorder hook (legacy)
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
  const handleWakeWord = useCallback(async () => {
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
      
      // Use ElevenLabs Agent or legacy flow
      if (useAgent && agentConfig?.agent_id) {
        console.log('[App] Using ElevenLabs Conversational AI')
        setAskState('conversation')
        try {
          await startConversation()
        } catch (err) {
          console.error('[App] Failed to start conversation:', err)
          // Fallback to legacy flow
          console.log('[App] Falling back to legacy flow')
          setAskState('listening')
          startRecording()
        }
      } else {
        // Legacy flow
        console.log('[App] Using legacy STT-LLM-TTS flow')
        setAskState('listening')
        startRecording()
      }
    }
  }, [askState, alignment.length, useAgent, agentConfig, startConversation, startRecording])

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

  // Handle completed voice recording (legacy flow)
  async function handleRecordingComplete(audioBlob) {
    timingRef.current.t0_recordingComplete = performance.now()
    console.log('[Timing] T0 - Recording complete, starting pipeline...')
    
    setAskState('transcribing')
    console.log('[App] Transcribing audio, size:', audioBlob.size)
    
    try {
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

  // Send question to Bard (legacy flow)
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
      
      if (askData.audio_url && answerAudioRef.current) {
        answerAudioRef.current.src = askData.audio_url
        
        const handlePlay = () => {
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

  // Handle recording error (legacy)
  function handleRecordingError(errorMsg) {
    console.error('[App] Recording error:', errorMsg)
    setAskError(errorMsg)
    setAskState(null)
    resumePlayback()
  }

  // Handle answer audio ended - auto-resume narration (legacy)
  function handleAnswerAudioEnded() {
    console.log('[App] Answer audio ended, resuming narration')
    resumePlayback()
  }

  // Fetch agent configuration
  useEffect(() => {
    fetch('/agent/config')
      .then(res => {
        if (!res.ok) {
          console.warn('[App] Agent config not available, using legacy flow')
          setUseAgent(false)
          return null
        }
        return res.json()
      })
      .then(data => {
        if (data) {
          console.log('[App] Agent config loaded:', data)
          setAgentConfig(data)
          setUseAgent(data.use_agent)
        }
      })
      .catch(err => {
        console.warn('[App] Failed to fetch agent config:', err)
        setUseAgent(false)
      })
  }, [])

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
    
    // End conversation if in agent mode
    if (askState === 'conversation') {
      endConversation()
    }
    
    resumePlayback()
  }, [cancelRecording, askState, endConversation, resumePlayback])

  // Manual resume button handler
  const handleManualResume = useCallback(() => {
    console.log('[App] Manual resume triggered')
    if (askState === 'conversation') {
      endConversation()
    } else {
      resumePlayback()
    }
  }, [askState, endConversation, resumePlayback])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev)
  }, [])

  // Determine mic/conversation indicator state
  const micIsActive = wakeWordListening && wakeWordLoaded && !wakeWordError
  const isInConversation = askState === 'conversation'
  
  // Map conversation state to display state
  const getConversationDisplayState = () => {
    if (!isInConversation) return null
    switch (conversationState) {
      case ConversationState.CONNECTING:
        return 'connecting'
      case ConversationState.LISTENING:
        return 'listening'
      case ConversationState.SPEAKING:
        return 'speaking'
      default:
        return 'idle'
    }
  }

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

  const conversationDisplayState = getConversationDisplayState()

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
          
          {/* Mic/Conversation Indicator - centered above player */}
          <div className="flex flex-col items-center mb-6">
            <div 
              className={`
                transition-all duration-300
                ${micIsActive && !isInConversation ? 'mic-glow-pulse' : ''}
                ${conversationDisplayState === 'listening' ? 'mic-glow-pulse' : ''}
                ${conversationDisplayState === 'speaking' ? 'animate-pulse' : ''}
              `}
              title={
                isInConversation 
                  ? `Conversation: ${conversationDisplayState}`
                  : wakeWordError 
                    ? `Error: ${wakeWordError}` 
                    : micIsActive 
                      ? 'Listening for "Hey Bard"' 
                      : 'Mic inactive'
              }
            >
              <svg 
                className={`w-12 h-12 transition-colors duration-300 ${
                  isInConversation 
                    ? conversationDisplayState === 'speaking' 
                      ? 'text-gold-400' 
                      : 'text-gold-500'
                    : micIsActive 
                      ? 'text-gold-500' 
                      : 'text-ink-500'
                }`}
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            </div>
            
            {/* Silence countdown */}
            {isInConversation && silenceCountdown !== null && (
              <p className="text-ink-400 text-sm mt-2 animate-pulse">
                Resuming in {silenceCountdown}s...
              </p>
            )}
            
            {/* Conversation status */}
            {isInConversation && (
              <p className="text-parchment-200 text-sm mt-1">
                {conversationDisplayState === 'connecting' && 'Connecting...'}
                {conversationDisplayState === 'listening' && 'Listening...'}
                {conversationDisplayState === 'speaking' && 'Speaking...'}
              </p>
            )}
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
              conversationState={conversationDisplayState}
            />
          </section>

          {/* Resume button during conversation */}
          {isInConversation && (
            <div className="flex justify-center mb-8">
              <button
                onClick={handleManualResume}
                className="px-6 py-3 bg-ink-700 hover:bg-ink-600 text-parchment-100 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Resume Audiobook
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Hidden audio element for answer playback (legacy) */}
      <audio 
        ref={answerAudioRef}
        onEnded={handleAnswerAudioEnded}
        className="hidden"
      />

    </div>
  )
}

export default App
