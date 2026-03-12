# frozen_string_literal: true

require "json"

class Json3Parser
  def self.parse(json_text)
    data = JSON.parse(json_text)
    events = data["events"] || []

    words = []

    events.each do |event|
      next unless event["segs"]
      start_ms = event["tStartMs"] || 0
      event_duration_ms = event["dDurationMs"] || 1000

      event["segs"].each_with_index do |seg, i|
        text = seg["utf8"] || ""
        offset_ms = seg["tOffsetMs"] || 0

        next_offset = if i + 1 < event["segs"].length
                        event["segs"][i + 1]["tOffsetMs"] || offset_ms
                      else
                        event_duration_ms
                      end

        word_start = (start_ms + offset_ms) / 1000.0
        word_end = (start_ms + next_offset) / 1000.0

        cleaned = text.strip
        next if cleaned.empty?

        last = words.last
        if last && last[:text] == cleaned && (word_start - last[:start]).abs < 0.1
          last[:end] = [last[:end] || word_end, word_end].max
          next
        end

        words << { text: cleaned, start: word_start, end: word_end }
      end
    end

    words.sort_by! { |w| w[:start] }

    cues = []
    current_words = []
    current_text = ""
    current_start = nil

    words.each do |word|
      current_start ||= word[:start]
      current_words << word
      current_text += (current_text.empty? ? "" : " ") + word[:text]

      duration = word[:start] - current_start
      if duration > 5.0 || word[:text].match?(/[.?!]$/)
        cues << {
          start: current_start,
          end: word[:end],
          text: current_text,
          words: current_words
        }
        current_words = []
        current_text = ""
        current_start = nil
      end
    end

    if current_words.any?
      cues << {
        start: current_start,
        end: current_words.last[:end],
        text: current_text,
        words: current_words
      }
    end

    cues
  end
end
