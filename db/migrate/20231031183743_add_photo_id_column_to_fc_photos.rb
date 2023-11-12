class AddPhotoIdColumnToFcPhotos < ActiveRecord::Migration[7.0]
  def change
    add_column :fc_photos, :photoID, :string
  end
end
