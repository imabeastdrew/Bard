import { forwardRef, useEffect, useRef, useState } from 'react'

const AudioPlayer = forwardRef(function AudioPlayer(
  { chapterId, chapterTitle, duration, onTimeUpdate, onPlayStateChange },
  ref
) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const progressRef = useRef(null)

  const audioSrc = `/chapters/${chapterId}/audio`

  // Reset when chapter changes
  useEffect(() => {
    setIsLoaded(false)
    setCurrentTime(0)
    setIsPlaying(false)
  }, [chapterId])

  const handleLoadedData = () => {
    setIsLoaded(true)
  }

  const handleTimeUpdate = () => {
    if (ref.current) {
      const time = ref.current.currentTime
      setCurrentTime(time)
      onTimeUpdate?.(time)
    }
  }

  const handlePlay = () => {
    setIsPlaying(true)
    onPlayStateChange?.(true)
  }

  const handlePause = () => {
    setIsPlaying(false)
    onPlayStateChange?.(false)
  }

  const handleEnded = () => {
    setIsPlaying(false)
    onPlayStateChange?.(false)
  }

  const togglePlay = () => {
    if (!ref.current) return
    if (isPlaying) {
      ref.current.pause()
    } else {
      ref.current.play()
    }
  }

  const handleProgressClick = (e) => {
    if (!ref.current || !progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newTime = percent * duration
    ref.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleSkip = (seconds) => {
    if (!ref.current) return
    ref.current.currentTime = Math.max(0, Math.min(ref.current.currentTime + seconds, duration || 0))
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  return (
    <div className="space-y-4">
      <audio
        ref={ref}
        src={audioSrc}
        onLoadedData={handleLoadedData}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        preload="auto"
      />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ink-800">{chapterTitle}</h2>
        {!isLoaded && (
          <span className="text-ink-500 text-sm animate-pulse">Loading audio...</span>
        )}
      </div>

      {/* Progress Bar */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        className="h-3 bg-parchment-300 rounded-full cursor-pointer overflow-hidden group"
      >
        <div
          className="h-full bg-gradient-to-r from-gold-500 to-gold-600 rounded-full transition-all duration-100 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-gold-400 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Time Display */}
      <div className="flex justify-between text-ink-500 text-sm font-mono">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration || 0)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => handleSkip(-10)}
          className="p-2 text-ink-600 hover:text-ink-800 transition-colors"
          title="Rewind 10 seconds"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>

        <button
          onClick={togglePlay}
          disabled={!isLoaded}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 text-white shadow-lg shadow-gold-500/40 hover:from-gold-400 hover:to-gold-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isPlaying ? (
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => handleSkip(10)}
          className="p-2 text-ink-600 hover:text-ink-800 transition-colors"
          title="Forward 10 seconds"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
          </svg>
        </button>
      </div>
    </div>
  )
})

export default AudioPlayer

