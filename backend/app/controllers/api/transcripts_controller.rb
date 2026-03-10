# frozen_string_literal: true

module Api
  class TranscriptsController < ApplicationController
    def create
      url = params.require(:url)
      result = TranscriptFetcher.call(url)
      render json: result
    rescue ActionController::ParameterMissing
      render json: { message: "url is required" }, status: :unprocessable_entity
    rescue TranscriptFetcher::InvalidUrl => e
      render json: { message: e.message }, status: :unprocessable_entity
    rescue TranscriptFetcher::TranscriptNotFound => e
      render json: { message: e.message }, status: :not_found
    rescue TranscriptFetcher::FetchError => e
      render json: { message: e.message }, status: :bad_gateway
    end
  end
end
