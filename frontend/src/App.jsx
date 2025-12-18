import { useState, useEffect, useRef, useCallback } from 'react'
import AudioPlayer from './components/AudioPlayer'
import ChapterSelector from './components/ChapterSelector'
import AskBardButton from './components/AskBardButton'
import CurrentSentence from './components/CurrentSentence'
import Header from './components/Header'
import useVoiceRecorder from './hooks/useVoiceRecorder'

function App() {
  const [chapters, setChapters] = useState([])
  const [currentChapter, setCurrentChapter] = useState(null)
  const [alignment, setAlignment] = useState([])
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
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

  // Voice recorder hook
  const {
    audioLevel,
    startRecording,
    cancelRecording,
  } = useVoiceRecorder({
    silenceThreshold: 0.015,
    silenceDuration: 1500,
    onRecordingComplete: handleRecordingComplete,
    onError: handleRecordingError,
  })

  // Handle completed voice recording
  async function handleRecordingComplete(audioBlob) {
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
      
      if (!transcribeData.text || transcribeData.text.trim().length === 0) {
        throw new Error('No speech detected. Please try again.')
      }
      
      const transcribedText = transcribeData.text
      console.log('[App] Transcript:', transcribedText)
      setTranscript(transcribedText)
      setAskState('preview')
      
      // Auto-send after preview
      previewTimeoutRef.current = setTimeout(() => {
        sendQuestion(transcribedText)
      }, 1500)
      
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
      console.log('[App] Answer received:', askData.answer?.substring(0, 50) + '...')
      
      setAnswer(askData.answer)
      setAnswerAudioUrl(askData.audio_url)
      setAskState('answer')
      
      // Auto-play answer audio if available
      if (askData.audio_url && answerAudioRef.current) {
        answerAudioRef.current.src = askData.audio_url
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

  // Start the Ask Bard flow
  const handleAskBard = useCallback(() => {
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
  }, [startRecording])

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-ink-600 font-serif text-lg">Loading Bard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <h2 className="font-display text-2xl text-ink-800 mb-4">Connection Error</h2>
          <p className="text-ink-600 mb-4">{error}</p>
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
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Chapter Selection */}
        <section className="mb-8">
          <ChapterSelector 
            chapters={chapters}
            currentChapter={currentChapter}
            onChapterChange={handleChapterChange}
          />
        </section>

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

        {/* Ask Bard Button */}
        <section className="text-center mb-8">
          <AskBardButton 
            onClick={handleAskBard}
            disabled={!currentChapter || !alignment.length || askState !== null}
          />
          {!alignment.length && currentChapter && (
            <p className="text-ink-500 text-sm mt-2">
              Alignment data not available for this chapter
            </p>
          )}
        </section>
      </main>

      {/* Hidden audio element for answer playback */}
      <audio 
        ref={answerAudioRef}
        onEnded={handleAnswerAudioEnded}
        className="hidden"
      />

      {/* Footer */}
      <footer className="text-center py-8 text-ink-500 text-sm">
        <p>Gospel of Luke · World English Bible · Public Domain</p>
      </footer>
    </div>
  )
}

export default App
