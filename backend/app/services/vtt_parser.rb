# frozen_string_literal: true

require "cgi"

class VttParser
  CUE_TIME_REGEX = /(?<start>\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(?<end>\d{2}:\d{2}:\d{2}\.\d{3})/
  # Matches <00:00:01.439><c> word</c> patterns in YouTube auto-generated VTT
  WORD_TIME_REGEX = /<(\d{2}:\d{2}:\d{2}\.\d{3})><c>(.*?)<\/c>/

  def self.parse(vtt_text)
    cues = []
    current = nil
    raw_lines = []
    skip_section = false

    vtt_text.each_line do |line|
      stripped = line.strip

      next if stripped.start_with?("WEBVTT")

      if stripped.start_with?("NOTE") || stripped.start_with?("STYLE") || stripped.start_with?("REGION")
        skip_section = true
        next
      end

      if skip_section
        skip_section = false if stripped.empty?
        next
      end

      if (match = CUE_TIME_REGEX.match(stripped))
        if current && raw_lines.any?
          finalize_cue(current, raw_lines)
          cues << current
        end
        current = { start: to_seconds(match[:start]), end: to_seconds(match[:end]) }
        raw_lines = []
        next
      end

      if stripped.empty?
        if current && raw_lines.any?
          finalize_cue(current, raw_lines)
          cues << current
        end
        current = nil
        raw_lines = []
        next
      end

      raw_lines << stripped if current
    end

    if current && raw_lines.any?
      finalize_cue(current, raw_lines)
      cues << current
    end

    deduplicate(cues)
  end

  def self.finalize_cue(cue, raw_lines)
    raw = raw_lines.join(" ")
    cue[:words] = extract_words(raw, cue[:start], cue[:end])
    cue[:text] = cue[:words].map { |w| w[:text] }.join(" ")
  end

  def self.extract_words(raw, cue_start, cue_end)
    words = []

    # Extract the first word (before any <timestamp><c> tags)
    first_text = raw.sub(/<\d{2}:\d{2}:\d{2}\.\d{3}>.*/, "").gsub(/<[^>]+>/, "")
    first_text = clean_word(first_text)
    words << { text: first_text, start: cue_start } unless first_text.empty?

    # Extract subsequent words from <timestamp><c>word</c> patterns
    raw.scan(WORD_TIME_REGEX).each do |timestamp, text|
      cleaned = clean_word(text)
      next if cleaned.empty?
      words << { text: cleaned, start: to_seconds(timestamp) }
    end

    # If no <c> tags found (or just one block), split plain text evenly
    if words.size <= 1 && raw.split(/\s+/).size > 1
      words = []
      plain = sanitize_text(raw)
      tokens = plain.split(/\s+/).reject(&:empty?)
      duration = cue_end - cue_start
      tokens.each_with_index do |token, i|
        words << { text: token, start: cue_start + (duration * i.to_f / [tokens.size, 1].max) }
      end
    end

    words
  end

  def self.deduplicate(cues)
    return cues if cues.empty?

    merged = [cues.first]
    cues.drop(1).each do |cue|
      prev = merged.last
      if cue[:text] == prev[:text] || prev[:text].end_with?(cue[:text]) || cue[:text].start_with?(prev[:text])
        prev[:end] = [prev[:end], cue[:end]].max
        if cue[:text].length >= prev[:text].length
          prev[:text] = cue[:text]
          prev[:words] = cue[:words]
        end
      else
        merged << cue
      end
    end
    merged
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

  def self.clean_word(text)
    cleaned = text.gsub(/<[^>]+>/, "")
    cleaned = CGI.unescapeHTML(cleaned)
    cleaned = cleaned.gsub("&nbsp;", "")
    cleaned = cleaned.tr("\u00A0", " ")
    cleaned.strip
  end
end
