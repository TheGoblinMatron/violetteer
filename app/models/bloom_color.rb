class BloomColor < ApplicationRecord
  has_many :variety_bloom_colors
  has_many :varieties, through: :variety_bloom_colors
end
