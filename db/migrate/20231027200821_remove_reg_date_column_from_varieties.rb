class RemoveRegDateColumnFromVarieties < ActiveRecord::Migration[7.0]
  def change
    remove_column :varieties, :regDate, :string
  end
end
