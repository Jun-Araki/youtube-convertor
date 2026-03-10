import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  let lastPlayer

  beforeEach(() => {
    lastPlayer = null
    window.YT = {
      Player: function PlayerMock(_, options = {}) {
        lastPlayer = this
        this.loadVideoById = vi.fn()
        this.seekTo = vi.fn()
        this.getCurrentTime = vi.fn(() => 0)
        options.events?.onReady?.({ target: this })
      },
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ videoId: 'abc123', captions: [] }),
    })
  })

  it('triggers fetch on paste', async () => {
    render(<App />)

    const input = screen.getByPlaceholderText('Paste a YouTube URL here')
    fireEvent.paste(input, {
      clipboardData: { getData: () => 'https://www.youtube.com/watch?v=abc123' },
    })

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/transcript',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('seeks when caption is clicked', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        videoId: 'abc123',
        captions: [{ start: 1.5, end: 2.5, text: 'Hello there' }],
      }),
    })

    render(<App />)

    const input = screen.getByPlaceholderText('Paste a YouTube URL here')
    fireEvent.paste(input, {
      clipboardData: { getData: () => 'https://www.youtube.com/watch?v=abc123' },
    })

    const captionButton = await screen.findByText('Hello there')
    fireEvent.click(captionButton)

    expect(lastPlayer.seekTo).toHaveBeenCalledWith(1.5, true)
  })
})
