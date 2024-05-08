class BloomColorsController < ApplicationController
  before_action :set_bloom_color, only: [:show]

  def index
    @bloom_colors = BloomColor.all
  end
  def show
  end

  private

  def set_bloom_color
    @bloom_color = BloomColor.find(params[:id])
  end

  def bloom_color_params
    params.require(:bloom_color).permit(:color)
  end
end