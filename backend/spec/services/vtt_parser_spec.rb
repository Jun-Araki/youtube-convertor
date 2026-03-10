# frozen_string_literal: true

require "rails_helper"

RSpec.describe VttParser do
  it "parses cues and strips tags" do
    vtt = <<~VTT
      WEBVTT

      00:00:01.000 --> 00:00:03.000
      Hello <c>world</c>

      00:00:04.000 --> 00:00:05.500
      Line one
      Line two
    VTT

    cues = described_class.parse(vtt)

    expect(cues.length).to eq(2)
    expect(cues[0]).to eq({ start: 1.0, end: 3.0, text: "Hello world" })
    expect(cues[1]).to eq({ start: 4.0, end: 5.5, text: "Line one Line two" })
  end

  it "ignores style and note blocks" do
    vtt = <<~VTT
      WEBVTT

      NOTE this is a comment
      should be ignored

      00:00:02.000 --> 00:00:03.000
      Hi

      STYLE
      ::cue { color: red; }

      00:00:04.000 --> 00:00:05.000
      There
    VTT

    cues = described_class.parse(vtt)

    expect(cues.map { |c| c[:text] }).to eq(["Hi", "There"])
  end

  it "decodes html entities" do
    vtt = <<~VTT
      WEBVTT

      00:00:01.000 --> 00:00:02.000
      Hello&nbsp;world &amp; friends
    VTT

    cues = described_class.parse(vtt)

    expect(cues.length).to eq(1)
    expect(cues[0][:text]).to eq("Hello world & friends")
  end
end
