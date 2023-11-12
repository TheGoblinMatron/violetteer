class Variety < ApplicationRecord
    validates :name, presence: true

    paginates_per 25

    has_many :fc_photos

end
