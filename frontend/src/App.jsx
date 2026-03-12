import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function App() {
  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState('')
  const [captions, setCaptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [currentTime, setCurrentTime] = useState(0)
  const [ytReady, setYtReady] = useState(false)

  const playerRef = useRef(null)
  const playerContainerRef = useRef(null)
  const captionsListRef = useRef(null)

  useEffect(() => {
    if (window.YT?.Player) {
      setYtReady(true)
      return
    }

    const existing = document.getElementById('youtube-iframe-api')
    if (existing) {
      existing.addEventListener('load', () => setYtReady(true))
      return
    }

    const script = document.createElement('script')
    script.id = 'youtube-iframe-api'
    script.src = 'https://www.youtube.com/iframe_api'
    window.onYouTubeIframeAPIReady = () => setYtReady(true)
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (!ytReady || !videoId) return

    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId)
      return
    }

    playerRef.current = new window.YT.Player(playerContainerRef.current, {
      videoId,
      playerVars: { rel: 0, modestbranding: 1 },
    })
  }, [videoId, ytReady])

  useEffect(() => {
    if (!playerRef.current || captions.length === 0) return

    const intervalId = window.setInterval(() => {
      if (!playerRef.current?.getCurrentTime) return
      const currentTime = playerRef.current.getCurrentTime()
      let index = -1
      for (let i = captions.length - 1; i >= 0; i--) {
        if (currentTime >= captions[i].start && currentTime < captions[i].end) {
          index = i
          break
        }
      }
      setCurrentTime(currentTime)
      setActiveIndex(index)
    }, 50)

    return () => window.clearInterval(intervalId)
  }, [captions, videoId])

  useEffect(() => {
    if (activeIndex < 0 || !captionsListRef.current) return
    const active = captionsListRef.current.querySelector(
      `[data-caption-index="${activeIndex}"]`
    )
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeIndex])

  const fetchTranscript = async (targetUrl) => {
    if (!targetUrl) return

    setLoading(true)
    setError('')
    setCaptions([])
    setActiveIndex(-1)

    try {
      const response = await fetch(`${API_BASE}/api/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.message || 'Failed to fetch transcript')
      }

      const payload = await response.json()
      setVideoId(payload.videoId)
      setCaptions(payload.captions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = (event) => {
    const pasted = event.clipboardData?.getData('text')
    if (!pasted) return

    event.preventDefault()
    setUrl(pasted)
    fetchTranscript(pasted)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    fetchTranscript(url)
  }

  const handleSeek = (cue) => {
    if (!playerRef.current?.seekTo) return
    playerRef.current.seekTo(cue.start, true)
  }

  const handleSeekToWord = (cue, wordIndex, event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (!playerRef.current?.seekTo) return
    const words = cue.words || []
    const word = words[wordIndex]
    const seekTime = word ? Math.max(0, word.start - 0.05) : cue.start
    playerRef.current.seekTo(seekTime, true)
  }

  const renderCaptionText = (cue, isActive) => {
    const words = cue.words || []

    if (!isActive) {
      return words.map((word, index) => (
        <span key={`word-${index}`}>
          {index > 0 && ' '}
          <span
            className="caption-word"
            onClick={(event) => handleSeekToWord(cue, index, event)}
            role="button"
            tabIndex={-1}
          >
            {word.text}
          </span>
        </span>
      ))
    }

    // Find the current word based on word-level timestamps
    let currentWordIndex = 0
    for (let i = words.length - 1; i >= 0; i--) {
      if (currentTime >= words[i].start) {
        currentWordIndex = i
        break
      }
    }

    const leading = []
    const trailing = []
    let currentToken = null

    words.forEach((word, index) => {
      const wordElement = (
        <span key={`word-${index}`}>
          {index > 0 && ' '}
          <span
            className="caption-word"
            onClick={(event) => handleSeekToWord(cue, index, event)}
            role="button"
            tabIndex={-1}
          >
            {word.text}
          </span>
        </span>
      )

      if (index < currentWordIndex) {
        leading.push(wordElement)
      } else if (index === currentWordIndex) {
        currentToken = wordElement
      } else {
        trailing.push(wordElement)
      }
    })

    return (
      <span className="caption-text">
        <span className="caption-rest">{leading}</span>
        <span className="caption-progress">{currentToken}</span>
        <span className="caption-rest">{trailing}</span>
      </span>
    )
  }

  const connectionStatus = loading ? 'loading' : videoId ? '' : 'offline'

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span className="prompt">{'>'}</span>
          listen_with_youtube
          <span className="cursor" />
        </h1>
        <p>Paste a YouTube URL to load English subtitles instantly.</p>
      </header>

      <div className="status-bar">
        <span className={`status-dot ${connectionStatus}`} />
        <span>
          {loading
            ? 'fetching transcript...'
            : videoId
              ? `streaming: ${videoId}`
              : 'ready — waiting for input'}
        </span>
        {captions.length > 0 && (
          <span style={{ marginLeft: 'auto' }}>
            {captions.length} cues loaded
          </span>
        )}
      </div>

      <form className="url-form" onSubmit={handleSubmit}>
        <input
          type="url"
          placeholder="$ paste youtube url here..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onPaste={handlePaste}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Run'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      <div className="content">
        <div className="player-panel">
          <div className="player-panel-header">
            <div className="window-dots">
              <span />
              <span />
              <span />
            </div>
            <span>player.tsx</span>
          </div>
          <div className="player-body">
            <div className="player" ref={playerContainerRef} />
            {!videoId && (
              <div className="placeholder">
                <span className="placeholder-icon">&#9654;</span>
                <span>Paste a URL to start.</span>
              </div>
            )}
          </div>
        </div>

        <div className="captions-panel">
          <div className="captions-header">
            <span className="label">
              <span className="icon">#</span>
              <span>captions</span>
            </span>
            <span className="count">{captions.length} lines</span>
          </div>
          <div className="captions-list" ref={captionsListRef}>
            {captions.map((cue, index) => (
              <button
                key={`${cue.start}-${index}`}
                type="button"
                className={index === activeIndex ? 'caption active' : 'caption'}
                onClick={() => handleSeek(cue)}
                data-caption-index={index}
              >
                <span className="caption-time">{formatTime(cue.start)}</span>
                {renderCaptionText(cue, index === activeIndex)}
              </button>
            ))}
            {!loading && captions.length === 0 && (
              <div className="caption-empty">
                {'// no captions loaded yet'}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="footer">
        <span>listen_with_youtube v1.0</span>
        <span>
          <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">V</kbd> to quick-load
        </span>
      </footer>
    </div>
  )
}

export default App
