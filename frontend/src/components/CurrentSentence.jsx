export default function CurrentSentence({ 
  sentence, 
  askState, 
  audioLevel = 0, 
  transcript, 
  answer,
  askError,
  onCancel 
}) {
  // Listening state - show recording UI
  if (askState === 'listening') {
    return (
      <div className="card p-6 animate-fade-in">
        <div className="flex flex-col items-center gap-4 py-4">
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
                  style={{ height: `${12 + i * 2}px` }}
                />
              )
            })}
          </div>

          <button
            onClick={onCancel}
            className="mt-2 text-ink-500 hover:text-ink-700 text-sm flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel (Esc)
          </button>
        </div>
      </div>
    )
  }

  // Transcribing state
  if (askState === 'transcribing') {
    return (
      <div className="card p-6 animate-fade-in">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 bg-ink-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-ink-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-ink-600 font-medium">Transcribing...</p>
        </div>
      </div>
    )
  }

  // Preview state - showing transcript
  if (askState === 'preview') {
    return (
      <div className="card p-6 animate-fade-in">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-full p-4 bg-parchment-200/50 rounded-lg border border-parchment-300">
            <p className="text-ink-500 text-xs uppercase tracking-wider mb-2">You asked:</p>
            <p className="text-ink-800 font-serif text-lg">"{transcript}"</p>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2 text-ink-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">Sending to Bard...</span>
          </div>
        </div>
      </div>
    )
  }

  // Thinking state
  if (askState === 'thinking') {
    return (
      <div className="card p-6 animate-fade-in">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-ink-900 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-ink-700 font-medium text-lg">Bard is thinking...</p>
          {transcript && (
            <p className="text-ink-500 text-sm text-center max-w-md">"{transcript}"</p>
          )}
        </div>
      </div>
    )
  }

  // Answer state
  if (askState === 'answer') {
    return (
      <div className="card p-6 animate-fade-in">
        <div className="space-y-4">
          {/* Answer */}
          <div className="p-4 bg-parchment-200/50 rounded-lg border border-parchment-300">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gold-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-display font-bold text-gold-700">B</span>
              </div>
              <div className="flex-1">
                <p className="text-ink-500 text-xs uppercase tracking-wider mb-1">Bard says:</p>
                <p className="text-ink-800 font-serif leading-relaxed">{answer}</p>
              </div>
            </div>
          </div>

          {/* Playing indicator */}
          <div className="flex items-center justify-center gap-2 text-gold-600">
            <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
            <span className="text-sm font-semibold">Playing answer...</span>
          </div>
          
          <p className="text-ink-400 text-xs text-center">
            Narration will resume automatically
          </p>
        </div>
      </div>
    )
  }

  // Error state - show error briefly then fall through to normal
  if (askError) {
    return (
      <div className="card p-6 animate-fade-in">
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
          <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-red-700 font-medium">Something went wrong</p>
            <p className="text-red-600 text-sm">{askError}</p>
          </div>
        </div>
      </div>
    )
  }

  // Default state - show current sentence
  if (!sentence) {
    return (
      <div className="card p-6">
        <div className="text-center text-ink-500 py-4">
          <p className="text-sm">Press play to start listening</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-gold-500/20 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-gold-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-ink-500 text-xs uppercase tracking-wider mb-1">Now Playing</p>
          <p className="text-ink-800 font-serif text-lg leading-relaxed italic">
            "{sentence.text}"
          </p>
          <p className="text-ink-400 text-xs mt-2 font-mono">
            Sentence #{sentence.sentence_id} · {sentence.start_time.toFixed(1)}s - {sentence.end_time.toFixed(1)}s
          </p>
        </div>
      </div>
    </div>
  )
}
