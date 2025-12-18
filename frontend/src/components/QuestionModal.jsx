import { useState, useEffect, useRef } from 'react'

export default function QuestionModal({ 
  isOpen, 
  onClose, 
  onAnswerComplete, 
  chapterId, 
  audioTime,
  currentSentence,
  answerAudioRef 
}) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlayingAnswer, setIsPlayingAnswer] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuestion('')
      setAnswer(null)
      setAudioUrl(null)
      setError(null)
      setIsPlayingAnswer(false)
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!question.trim() || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          chapter_id: chapterId,
          audio_time: audioTime
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to get answer')
      }

      const data = await response.json()
      setAnswer(data.answer)
      setAudioUrl(data.audio_url)

      // Auto-play answer if audio is available
      if (data.audio_url && answerAudioRef.current) {
        answerAudioRef.current.src = data.audio_url
        answerAudioRef.current.play()
        setIsPlayingAnswer(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswerEnded = () => {
    setIsPlayingAnswer(false)
  }

  const handleReplayAnswer = () => {
    if (answerAudioRef.current && audioUrl) {
      answerAudioRef.current.currentTime = 0
      answerAudioRef.current.play()
      setIsPlayingAnswer(true)
    }
  }

  const handleContinue = () => {
    if (answerAudioRef.current) {
      answerAudioRef.current.pause()
    }
    onAnswerComplete()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
        onClick={answer ? handleContinue : onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl card p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center">
              <span className="font-display text-lg font-bold text-ink-900">B</span>
            </div>
            <div>
              <h2 className="font-display text-xl text-ink-800">Ask Bard</h2>
              <p className="text-ink-500 text-sm">Paused at Luke {chapterId}</p>
            </div>
          </div>
          <button 
            onClick={answer ? handleContinue : onClose}
            className="p-2 text-ink-500 hover:text-ink-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current context */}
        {currentSentence && !answer && (
          <div className="mb-4 p-3 bg-parchment-200/50 rounded-lg border border-parchment-300">
            <p className="text-ink-500 text-xs uppercase tracking-wider mb-1">You stopped here:</p>
            <p className="text-ink-700 italic text-sm">"{currentSentence.text}"</p>
          </div>
        )}

        {/* Question Form */}
        {!answer && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="question" className="block text-ink-600 text-sm font-semibold mb-2">
                What would you like to know?
              </label>
              <textarea
                ref={inputRef}
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about characters, places, historical context..."
                className="input-field min-h-[100px] resize-none"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!question.trim() || isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Thinking...
                  </span>
                ) : 'Ask'}
              </button>
            </div>
          </form>
        )}

        {/* Answer Display */}
        {answer && (
          <div className="space-y-4">
            <div className="p-4 bg-parchment-200/50 rounded-lg border border-parchment-300">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-gold-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-display font-bold text-gold-700">B</span>
                </div>
                <div>
                  <p className="text-ink-500 text-xs uppercase tracking-wider mb-1">Bard says:</p>
                  <p className="text-ink-800 font-serif leading-relaxed">{answer}</p>
                </div>
              </div>
            </div>

            {/* Answer audio player */}
            <audio 
              ref={answerAudioRef}
              onEnded={handleAnswerEnded}
              className="hidden"
            />

            {audioUrl && (
              <div className="flex items-center gap-3 p-3 bg-ink-100 rounded-lg">
                {isPlayingAnswer ? (
                  <div className="flex items-center gap-2 text-gold-600">
                    <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    </svg>
                    <span className="text-sm font-semibold">Playing answer...</span>
                  </div>
                ) : (
                  <button
                    onClick={handleReplayAnswer}
                    className="flex items-center gap-2 text-ink-600 hover:text-ink-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">Replay answer</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleContinue}
                className="btn-primary"
              >
                Continue Listening
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

