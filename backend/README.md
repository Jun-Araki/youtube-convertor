# YouTube Convertor Backend (Rails API)

This is the API-only Rails backend for the YouTube Convertor application. It handles fetching and parsing YouTube transcript data with high precision.

## Key Services

- **TranscriptFetcher**: Orchestrates the fetching process using `yt-dlp`. It prioritizes auto-generated `json3` subtitles to gather word-level timestamps.
- **Json3Parser**: A specialized parser for YouTube's `json3` internal format, extracting precise `start` and `end` times for every word.
- **VttParser**: A fallback parser for standard WebVTT files, including logic to estimate word timings when markers are absent.

## API Endpoints

### POST `/api/transcript`
Fetches the transcript for a given YouTube URL.
- **Param**: `url` (Required)
- **Response**:
  ```json
  {
    "videoId": "...",
    "captions": [
      {
        "start": 0.4,
        "end": 6.08,
        "text": "...",
        "words": [
          { "text": "word", "start": 0.4, "end": 0.64 },
          ...
        ]
      }
    ]
  }
  ```

## Setup & Running

1. **Install Dependencies**: `bundle install`
2. **External Dependency**: Ensure `yt-dlp` is installed on your system.
3. **Run Server**: `rails s`
4. **Cache**: Uses `:memory_store` by default. Clear via `rails runner "Rails.cache.clear"` if needed.
