class AddVarietyReferenceToFcPhotos < ActiveRecord::Migration[7.0]
  def change
    add_reference :fc_photos, :variety, null: false, foreign_key: true
  end
end
