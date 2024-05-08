class Variety < ApplicationRecord
    validates :name, presence: true
    has_many :fc_photos
    has_many :variety_bloom_colors
    has_many :bloom_colors, through: :variety_bloom_colors
end
