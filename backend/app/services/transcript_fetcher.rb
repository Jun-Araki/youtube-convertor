# frozen_string_literal: true

require "open3"
require "uri"
require "rack/utils"
require "tmpdir"
require "timeout"

class TranscriptFetcher
  class InvalidUrl < StandardError; end
  class TranscriptNotFound < StandardError; end
  class FetchError < StandardError; end

  CACHE_TTL = 10.minutes

  def self.call(url)
    video_id = extract_video_id(url)
    raise InvalidUrl, "Invalid YouTube URL" unless video_id

    Rails.cache.fetch("transcript:#{video_id}", expires_in: CACHE_TTL) do
      captions = fetch_captions(url)
      { videoId: video_id, captions: captions }
    end
  end

  def self.extract_video_id(url)
    uri = URI.parse(url)
    host = uri.host&.downcase
    return if host.nil?

    if host.include?("youtu.be")
      id = uri.path.split("/")[1]
      return id if id && !id.empty?
    end

    if host.include?("youtube.com")
      params = Rack::Utils.parse_query(uri.query)
      return params["v"] if params["v"] && !params["v"].empty?

      if uri.path.start_with?("/embed/")
        id = uri.path.split("/")[2]
        return id if id && !id.empty?
      end
    end

    nil
  rescue URI::InvalidURIError
    nil
  end

  def self.fetch_captions(url)
    Dir.mktmpdir("yt_subs") do |dir|
      # Try fetching auto-generated subtitle for word-level precision
      auto_cmd = [
        "yt-dlp",
        "--skip-download",
        "--write-auto-sub",
        "--no-playlist",
        "--socket-timeout", "10",
        "--retries", "2",
        "--sub-lang", "en",
        "--sub-format", "json3",
        "--output", File.join(dir, "%(id)s.%(ext)s"),
        url
      ]

      Timeout.timeout(25) { Open3.capture3(*auto_cmd) }

      json3_path = Dir.glob(File.join(dir, "*.json3")).first

      # If no auto-generated sub, fallback to manual sub
      unless json3_path
        manual_cmd = [
          "yt-dlp",
          "--skip-download",
          "--write-sub",
          "--no-playlist",
          "--socket-timeout", "10",
          "--retries", "2",
          "--sub-lang", "en",
          "--sub-format", "json3/vtt/best",
          "--output", File.join(dir, "%(id)s.%(ext)s"),
          url
        ]
        stdout, stderr, status = Timeout.timeout(25) { Open3.capture3(*manual_cmd) }
        unless status.success?
          message = stderr.strip
          message = stdout.strip if message.empty?
          raise FetchError, "yt-dlp failed: #{message}"
        end
      end

      json3_path = Dir.glob(File.join(dir, "*.json3")).first
      return Json3Parser.parse(File.read(json3_path)) if json3_path

      vtt_path = Dir.glob(File.join(dir, "*.vtt")).first
      raise TranscriptNotFound, "No English subtitles found" unless vtt_path

      VttParser.parse(File.read(vtt_path))
    end
  rescue Timeout::Error
    raise FetchError, "yt-dlp timed out"
  end
end
