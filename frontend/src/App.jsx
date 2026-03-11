import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

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
      const index = captions.findIndex(
        (cue) => currentTime >= cue.start && currentTime < cue.end
      )
      setCurrentTime(currentTime)
      setActiveIndex(index)
    }, 250)

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

  const handleSeekToWord = (cue, wordIndex, wordCount, event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (!playerRef.current?.seekTo || wordCount <= 0) return
    const duration = Math.max(0.01, cue.end - cue.start)
    const progress = Math.min(1, Math.max(0, wordIndex / wordCount))
    const backtrack = 0.1
    const seekTime = Math.max(0, cue.start + duration * progress - backtrack)
    playerRef.current.seekTo(seekTime, true)
  }

  const renderCaptionText = (cue, isActive) => {
    const text = (cue.text || '').replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ')
    const tokens = text.split(/(\s+)/)
    const wordCount = tokens.filter((token) => token.trim().length > 0).length || 1
    if (!isActive) {
      let wordIndex = -1
      return tokens.map((token, index) => {
        const isWord = token.trim().length > 0
        if (isWord) wordIndex += 1
        const tokenWordIndex = wordIndex
        if (!isWord) return token
        return (
          <span
            key={`word-${index}`}
            className="caption-word"
            onClick={(event) =>
              handleSeekToWord(cue, tokenWordIndex, wordCount, event)
            }
            role="button"
            tabIndex={-1}
          >
            {token}
          </span>
        )
      })
    }

    const duration = Math.max(0.01, cue.end - cue.start)
    const progress = Math.min(1, Math.max(0, (currentTime - cue.start) / duration))
    const currentWordIndex = Math.min(wordCount - 1, Math.floor(wordCount * progress))

    let wordIndex = -1
    const leading = []
    const trailing = []
    let currentToken = null

    tokens.forEach((token, index) => {
      const isWord = token.trim().length > 0
      if (isWord) wordIndex += 1
      const tokenWordIndex = wordIndex

      if (!isWord) {
        if (wordIndex < currentWordIndex) {
          leading.push(token)
        } else {
          trailing.push(token)
        }
        return
      }

      const wordElement = (
        <span
          key={`word-${index}`}
          className="caption-word"
          onClick={(event) =>
            handleSeekToWord(cue, tokenWordIndex, wordCount, event)
          }
          role="button"
          tabIndex={-1}
        >
          {token}
        </span>
      )

      if (tokenWordIndex < currentWordIndex) {
        leading.push(wordElement)
      } else if (tokenWordIndex === currentWordIndex) {
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

  return (
    <div className="app">
      <header className="header">
        <h1>Listen With YouTube</h1>
        <p>Paste a YouTube URL to load English subtitles instantly.</p>
      </header>

      <form className="url-form" onSubmit={handleSubmit}>
        <input
          type="url"
          placeholder="Paste a YouTube URL here"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onPaste={handlePaste}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Load'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      <div className="content">
        <div className="player-panel">
          <div className="player" ref={playerContainerRef} />
          {!videoId && <div className="placeholder">Paste a URL to start.</div>}
        </div>

        <div className="captions-panel">
          <div className="captions-header">
            <span>Captions</span>
            <span>{captions.length} lines</span>
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
                {renderCaptionText(cue, index === activeIndex)}
              </button>
            ))}
            {!loading && captions.length === 0 && (
              <div className="caption-empty">No captions loaded yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
