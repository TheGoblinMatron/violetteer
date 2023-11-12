class CreateFcPhotos < ActiveRecord::Migration[7.0]
  def change
    create_table :fc_photos do |t|
      t.string :location
      t.string :attribution

      t.timestamps
    end
  end
end
