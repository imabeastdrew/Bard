export default function Header() {
  return (
    <header className="bg-ink-900 text-parchment-100 py-6 px-4 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-gold-400 via-gold-500 to-gold-700 rounded-full flex items-center justify-center shadow-lg shadow-gold-500/30">
            <span className="font-display text-2xl font-bold text-ink-900">B</span>
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-wide">Bard</h1>
            <p className="text-parchment-400 text-sm">Interactive Audiobook</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-lg text-gold-400">Gospel of Luke</p>
          <p className="text-parchment-500 text-xs uppercase tracking-wider">World English Bible</p>
        </div>
      </div>
    </header>
  )
}

