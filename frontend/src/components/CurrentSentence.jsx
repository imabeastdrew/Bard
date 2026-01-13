export default function CurrentSentence({ 
  sentence, 
  askState, 
  audioLevel = 0, 
  transcript, 
  answer,
  askError,
  onCancel,
  conversationState // New: 'connecting' | 'listening' | 'speaking' | null
}) {
  // Conversation state (ElevenLabs Agent mode)
  if (askState === 'conversation') {
    return (
      <div className="card p-6 animate-fade-in">
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Conversation indicator */}
          <div className="relative">
            {conversationState === 'listening' && (
              <div 
                className="absolute inset-0 bg-gold-500/30 rounded-full animate-ping"
                style={{ animationDuration: '1.5s' }}
              />
            )}
            <div 
              className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                conversationState === 'speaking' 
                  ? 'bg-gradient-to-br from-gold-300 via-gold-400 to-gold-600 shadow-gold-400/40 animate-pulse' 
                  : conversationState === 'listening'
                    ? 'bg-gradient-to-br from-gold-400 via-gold-500 to-gold-700 shadow-gold-500/40'
                    : 'bg-ink-700'
              }`}
            >
              {conversationState === 'speaking' ? (
                // Audio wave icon for speaking
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              ) : conversationState === 'connecting' ? (
                // Spinner for connecting
                <svg className="w-10 h-10 text-gold-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                // Mic icon for listening
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              )}
            </div>
          </div>

          <p className="text-parchment-100 font-medium text-lg">
            {conversationState === 'connecting' && 'Connecting to Bard...'}
            {conversationState === 'listening' && 'Listening...'}
            {conversationState === 'speaking' && 'Bard is speaking...'}
            {!conversationState && 'In conversation...'}
          </p>
          
          <p className="text-ink-400 text-sm text-center max-w-md">
            {conversationState === 'listening' && 'Ask your question or say "resume" to continue the audiobook'}
            {conversationState === 'speaking' && 'You can interrupt by speaking'}
            {conversationState === 'connecting' && 'Please wait...'}
          </p>

          <button
            onClick={onCancel}
            className="mt-2 text-ink-400 hover:text-parchment-100 text-sm flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            End Conversation
          </button>
        </div>
      </div>
    )
  }

  // Listening state - show recording UI (legacy flow)
  if (askState === 'listening') {
    return (
      <div className="card p-6 animate-fade-in">
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Pulsing microphone indicator */}
          <div className="relative">
            <div 
              className="absolute inset-0 bg-gold-500/30 rounded-full animate-ping"
              style={{ animationDuration: '1.5s' }}
            />
            <div 
              className="relative w-20 h-20 bg-gradient-to-br from-gold-400 via-gold-500 to-gold-700 rounded-full flex items-center justify-center shadow-lg shadow-gold-500/40"
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

          <p className="text-parchment-100 font-medium text-lg">Listening...</p>
          <p className="text-ink-400 text-sm">Speak your question</p>

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
                      ? i < 4 ? 'bg-amber-400' : i < 8 ? 'bg-gold-400' : 'bg-gold-500'
                      : 'bg-ink-600'
                  }`}
                  style={{ height: `${12 + i * 2}px` }}
                />
              )
            })}
          </div>

          <button
            onClick={onCancel}
            className="mt-2 text-ink-400 hover:text-parchment-100 text-sm flex items-center gap-1 transition-colors"
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
          <div className="w-16 h-16 bg-ink-700 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gold-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-parchment-100 font-medium">Transcribing...</p>
        </div>
      </div>
    )
  }

  // Preview state - showing transcript
  if (askState === 'preview') {
    return (
      <div className="card p-6 animate-fade-in">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-full p-4 bg-ink-700/50 rounded-lg border border-ink-600">
            <p className="text-ink-400 text-xs uppercase tracking-wider mb-2">You asked:</p>
            <p className="text-parchment-100 font-serif text-lg">"{transcript}"</p>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2 text-gold-500">
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
          <div className="w-16 h-16 bg-gradient-to-br from-gold-400 via-gold-500 to-gold-700 rounded-full flex items-center justify-center shadow-lg shadow-gold-500/40">
            <svg className="w-8 h-8 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-parchment-100 font-medium text-lg">Bard is thinking...</p>
          {transcript && (
            <p className="text-ink-400 text-sm text-center max-w-md">"{transcript}"</p>
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
          <div className="p-4 bg-ink-700/50 rounded-lg border border-ink-600">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gold-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-display font-bold text-gold-500">B</span>
              </div>
              <div className="flex-1">
                <p className="text-ink-400 text-xs uppercase tracking-wider mb-1">Bard says:</p>
                <p className="text-parchment-100 font-serif leading-relaxed">{answer}</p>
              </div>
            </div>
          </div>

          {/* Playing indicator */}
          <div className="flex items-center justify-center gap-2 text-gold-500">
            <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
            <span className="text-sm font-semibold">Playing answer...</span>
          </div>
          
          <p className="text-ink-500 text-xs text-center">
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
        <div className="flex items-center gap-3 p-4 bg-gold-500/10 rounded-lg border border-gold-500/30">
          <svg className="w-6 h-6 text-gold-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-gold-400 font-medium">Something went wrong</p>
            <p className="text-gold-500/80 text-sm">{askError}</p>
          </div>
        </div>
      </div>
    )
  }

  // Default state - show current sentence
  if (!sentence) {
    return (
      <div className="card p-6">
        <div className="text-center text-ink-400 py-4">
          <p className="text-sm">Press play to start listening</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-gold-500/20 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-gold-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-ink-400 text-xs uppercase tracking-wider mb-1">Now Playing</p>
          <p className="text-parchment-100 font-serif text-lg leading-relaxed italic">
            "{sentence.text}"
          </p>
          <p className="text-ink-500 text-xs mt-2 font-mono">
            Sentence #{sentence.sentence_id} · {sentence.start_time.toFixed(1)}s - {sentence.end_time.toFixed(1)}s
          </p>
        </div>
      </div>
    </div>
  )
}
