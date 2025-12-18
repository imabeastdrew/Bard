export default function AskBardButton({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative px-8 py-4 bg-gradient-to-br from-ink-800 to-ink-950 text-parchment-100 
                 font-display text-xl font-semibold rounded-2xl shadow-2xl shadow-ink-900/40
                 hover:from-ink-700 hover:to-ink-900 hover:shadow-ink-800/50
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-ink-800 disabled:hover:to-ink-950
                 transition-all duration-300 active:scale-95"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <svg className="w-5 h-5 text-ink-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span>Ask Bard</span>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-gold-500/0 via-gold-500/10 to-gold-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-gold-500/20 via-transparent to-gold-500/20 opacity-0 group-hover:opacity-100 blur transition-opacity" />
    </button>
  )
}

