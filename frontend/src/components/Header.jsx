export default function Header({ onToggleSidebar, isSidebarOpen }) {
  return (
    <header className="bg-ink-900 text-parchment-100 py-4 px-4 border-b border-ink-700 relative z-50">
      <div className="flex items-center gap-4">
        {/* Sidebar toggle button */}
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-ink-800 transition-colors"
          title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <svg 
            className="w-6 h-6 text-ink-400 hover:text-parchment-100 transition-colors" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {isSidebarOpen ? (
              // Panel close icon
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" 
              />
            ) : (
              // Panel open icon (sidebar icon)
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" 
              />
            )}
          </svg>
        </button>

        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-gold-400 via-gold-500 to-gold-700 rounded-full flex items-center justify-center shadow-lg shadow-gold-500/30">
            <span className="font-display text-xl font-bold text-white">B</span>
          </div>
          <h1 className="font-display text-xl font-semibold tracking-wide text-parchment-100">Bard</h1>
        </div>
      </div>
    </header>
  )
}
