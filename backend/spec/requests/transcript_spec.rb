# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Transcript API", type: :request do
  describe "POST /api/transcript" do
    it "returns transcript payload" do
      allow(TranscriptFetcher).to receive(:call).and_return(
        {
          videoId: "abc123",
          captions: [
            { start: 1.0, end: 2.0, text: "Hello" }
          ]
        }
      )

      post "/api/transcript", params: { url: "https://www.youtube.com/watch?v=abc123" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["videoId"]).to eq("abc123")
      expect(body["captions"].length).to eq(1)
    end

    it "returns 422 for invalid url" do
      allow(TranscriptFetcher).to receive(:call).and_raise(TranscriptFetcher::InvalidUrl, "Invalid YouTube URL")

      post "/api/transcript", params: { url: "not-a-url" }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 when url missing" do
      post "/api/transcript", params: {}

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
