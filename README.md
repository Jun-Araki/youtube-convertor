# YouTube Convertor

A web application that allows users to interact with YouTube transcripts. You can watch videos while following along with a side-by-side transcript that synchronizes perfectly at the word level.

## Key Features

- **Word-Level Click-to-Seek**: Click any individual word in the transcript to instantly jump the video to that exact moment.
- **Precise Word Highlighting**: The currently spoken word is highlighted in real-time as the video plays, ensuring you never lose your place.
- **Accurate Timing**: Utilizes YouTube's `json3` internal subtitle format to ensure precise synchronization, even during silences or varying speech speeds.
- **Side-by-Side Interface**: Clean, responsive layout with the video player on the left and a scrollable captions panel on the right.

## Tech Stack

- **Frontend**: React, Vite, Vanilla CSS.
- **Backend**: Ruby on Rails (API-only).
- **Tools**: `yt-dlp` for fetching high-precision transcript data.

## Getting Started

### Prerequisites

- Ruby 3.x
- Node.js (Latest LTS recommended)
- `yt-dlp` (Must be installed and available in PATH)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Jun-Araki/youtube-convertor.git
   cd youtube-convertor
   ```

2. Setup Backend:
   ```bash
   cd backend
   bundle install
   rails s
   ```

3. Setup Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

The application will be available at `http://localhost:5173`.
