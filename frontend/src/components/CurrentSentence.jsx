export default function CurrentSentence({ sentence }) {
  if (!sentence) return null

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

