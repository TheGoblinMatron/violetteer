class AddRecNumFcColumnToFcPhotos < ActiveRecord::Migration[7.0]
  def change
    add_column :fc_photos, :recNumFC, :integer
  end
end
