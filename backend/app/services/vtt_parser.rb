# frozen_string_literal: true

require "cgi"

class VttParser
  CUE_TIME_REGEX = /(?<start>\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(?<end>\d{2}:\d{2}:\d{2}\.\d{3})/

  def self.parse(vtt_text)
    cues = []
    current = nil
    text_lines = []
    skip_section = false

    vtt_text.each_line do |line|
      stripped = line.strip

      if stripped.start_with?("WEBVTT")
        next
      end

      if stripped.start_with?("NOTE") || stripped.start_with?("STYLE") || stripped.start_with?("REGION")
        skip_section = true
        next
      end

      if skip_section
        if stripped.empty?
          skip_section = false
        end
        next
      end

      if (match = CUE_TIME_REGEX.match(stripped))
        if current && text_lines.any?
          current[:text] = sanitize_text(text_lines.join(" "))
          cues << current
        end
        current = { start: to_seconds(match[:start]), end: to_seconds(match[:end]) }
        text_lines = []
        next
      end

      if stripped.empty?
        if current && text_lines.any?
          current[:text] = sanitize_text(text_lines.join(" "))
          cues << current
        end
        current = nil
        text_lines = []
        next
      end

      if current
        text_lines << stripped
      end
    end

    if current && text_lines.any?
      current[:text] = sanitize_text(text_lines.join(" "))
      cues << current
    end

    cues
  end

  def self.to_seconds(timestamp)
    hours, minutes, rest = timestamp.split(":")
    seconds, millis = rest.split(".")
    (hours.to_i * 3600) + (minutes.to_i * 60) + seconds.to_i + (millis.to_i / 1000.0)
  end

  def self.sanitize_text(text)
    cleaned = text.gsub(/<[^>]+>/, "")
    cleaned = CGI.unescapeHTML(cleaned)
    cleaned = cleaned.gsub("&nbsp;", "")
    cleaned = cleaned.tr("\u00A0", " ")
    cleaned.gsub(/\s+/, " ").strip
  end
end
