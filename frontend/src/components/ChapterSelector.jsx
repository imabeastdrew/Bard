export default function ChapterSelector({ chapters, currentChapter, onChapterChange }) {
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="card p-4">
      <label className="block text-ink-600 text-sm font-semibold mb-2 uppercase tracking-wider">
        Select Chapter
      </label>
      <div className="flex gap-2 items-center">
        <select
          value={currentChapter?.chapter_id || ''}
          onChange={(e) => {
            const chapter = chapters.find(c => c.chapter_id === parseInt(e.target.value))
            if (chapter) onChapterChange(chapter)
          }}
          className="flex-1 input-field"
        >
          {chapters.map((chapter) => (
            <option key={chapter.chapter_id} value={chapter.chapter_id}>
              {chapter.title} ({formatDuration(chapter.duration_seconds)})
            </option>
          ))}
        </select>
        
        <div className="flex gap-1">
          <button
            onClick={() => {
              const idx = chapters.findIndex(c => c.chapter_id === currentChapter?.chapter_id)
              if (idx > 0) onChapterChange(chapters[idx - 1])
            }}
            disabled={!currentChapter || chapters.findIndex(c => c.chapter_id === currentChapter?.chapter_id) === 0}
            className="btn-secondary px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous chapter"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => {
              const idx = chapters.findIndex(c => c.chapter_id === currentChapter?.chapter_id)
              if (idx < chapters.length - 1) onChapterChange(chapters[idx + 1])
            }}
            disabled={!currentChapter || chapters.findIndex(c => c.chapter_id === currentChapter?.chapter_id) === chapters.length - 1}
            className="btn-secondary px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next chapter"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      
      {currentChapter && (
        <p className="text-ink-500 text-sm mt-2">
          {currentChapter.sentence_count} sentences · {formatDuration(currentChapter.duration_seconds)}
        </p>
      )}
    </div>
  )
}

