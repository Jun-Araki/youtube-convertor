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
      cmd = [
        "yt-dlp",
        "--skip-download",
        "--write-sub",
        "--write-auto-sub",
        "--no-playlist",
        "--socket-timeout", "10",
        "--retries", "2",
        "--sub-lang", "en",
        "--sub-format", "vtt",
        "--output", File.join(dir, "%(id)s.%(ext)s"),
        url
      ]

      stdout, stderr, status = Timeout.timeout(25) { Open3.capture3(*cmd) }
      unless status.success?
        message = stderr.strip
        message = stdout.strip if message.empty?
        raise FetchError, "yt-dlp failed: #{message}"
      end

      vtt_path = Dir.glob(File.join(dir, "*.vtt")).first
      raise TranscriptNotFound, "No English subtitles found" unless vtt_path

      VttParser.parse(File.read(vtt_path))
    end
  rescue Timeout::Error
    raise FetchError, "yt-dlp timed out"
  end
end
