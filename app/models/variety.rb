class Variety < ApplicationRecord
    validates :name, presence: true

    has_many :fc_photos

end
