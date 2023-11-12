class AddRecNumFcToVarieties < ActiveRecord::Migration[7.0]
  def change
    add_column :varieties, :recNumFC, :integer
  end
end
