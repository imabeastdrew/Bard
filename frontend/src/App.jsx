import { useState, useEffect, useRef, useCallback } from 'react'
import AudioPlayer from './components/AudioPlayer'
import ChapterSelector from './components/ChapterSelector'
import AskBardButton from './components/AskBardButton'
import QuestionModal from './components/QuestionModal'
import CurrentSentence from './components/CurrentSentence'
import Header from './components/Header'

function App() {
  const [chapters, setChapters] = useState([])
  const [currentChapter, setCurrentChapter] = useState(null)
  const [alignment, setAlignment] = useState([])
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const audioRef = useRef(null)
  const answerAudioRef = useRef(null)
  const pausedTimeRef = useRef(0)

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

  const handleAskBard = useCallback(() => {
    // Pause audio and open modal
    if (audioRef.current) {
      audioRef.current.pause()
      pausedTimeRef.current = audioRef.current.currentTime
    }
    setIsPlaying(false)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const handleAnswerComplete = useCallback(() => {
    // Resume playback after answer
    setIsModalOpen(false)
    if (audioRef.current) {
      audioRef.current.currentTime = pausedTimeRef.current
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [])

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

        {/* Current Sentence Display */}
        {currentSentence && (
          <section className="mb-8">
            <CurrentSentence sentence={currentSentence} />
          </section>
        )}

        {/* Ask Bard Button */}
        <section className="text-center mb-8">
          <AskBardButton 
            onClick={handleAskBard}
            disabled={!currentChapter || !alignment.length}
          />
          {!alignment.length && currentChapter && (
            <p className="text-ink-500 text-sm mt-2">
              Alignment data not available for this chapter
            </p>
          )}
        </section>
      </main>

      {/* Question Modal */}
      <QuestionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAnswerComplete={handleAnswerComplete}
        chapterId={currentChapter?.chapter_id}
        audioTime={pausedTimeRef.current}
        currentSentence={currentSentence}
        answerAudioRef={answerAudioRef}
      />

      {/* Footer */}
      <footer className="text-center py-8 text-ink-500 text-sm">
        <p>Gospel of Luke · World English Bible · Public Domain</p>
      </footer>
    </div>
  )
}

export default App

