export default function ChapterSidebar({ chapters, currentChapter, onChapterChange, isOpen }) {
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      {/* Overlay for mobile - closes sidebar when clicking outside */}
      {isOpen && (
        <div 
          className="fixed top-[57px] inset-x-0 bottom-0 bg-black/50 z-30 lg:hidden"
          onClick={() => onChapterChange && null}
        />
      )}
      
      {/* Sidebar - positioned below header */}
      <aside
        className={`
          fixed top-[57px] left-0 h-[calc(100vh-57px)] z-40
          bg-ink-900 border-r border-ink-700
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full'}
          overflow-hidden
        `}
      >
        <div className="w-72 h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-ink-700">
            <h2 className="text-parchment-100 font-display text-lg font-semibold tracking-wide">
              Chapters
            </h2>
            <p className="text-ink-400 text-sm mt-1">
              {chapters.length} chapters available
            </p>
          </div>

          {/* Chapter List */}
          <nav className="flex-1 overflow-y-auto py-2">
            {chapters.map((chapter, index) => {
              const isActive = currentChapter?.chapter_id === chapter.chapter_id
              
              return (
                <button
                  key={chapter.chapter_id}
                  onClick={() => onChapterChange(chapter)}
                  className={`
                    w-full px-4 py-3 text-left transition-all duration-150
                    flex items-start gap-3 group
                    ${isActive 
                      ? 'bg-gold-500/15 border-l-2 border-gold-500' 
                      : 'hover:bg-ink-800 border-l-2 border-transparent'
                    }
                  `}
                >
                  {/* Chapter number */}
                  <span className={`
                    w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                    text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-gold-500 text-white' 
                      : 'bg-ink-700 text-ink-400 group-hover:bg-ink-600'
                    }
                  `}>
                    {index + 1}
                  </span>
                  
                  {/* Chapter info */}
                  <div className="flex-1 min-w-0">
                    <p className={`
                      font-serif text-sm leading-snug truncate
                      ${isActive ? 'text-parchment-100' : 'text-ink-300 group-hover:text-parchment-100'}
                    `}>
                      {chapter.title}
                    </p>
                    <p className="text-ink-500 text-xs mt-1 font-mono">
                      {formatDuration(chapter.duration_seconds)}
                      {chapter.sentence_count && ` · ${chapter.sentence_count} sentences`}
                    </p>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <svg className="w-4 h-4 text-gold-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-ink-700">
            <p className="text-ink-500 text-xs text-center">
              Select a chapter to begin
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}

