class AddRegDateColumnAsDateToVarieties < ActiveRecord::Migration[7.0]
  def change
    add_column :varieties, :regDate, :date
  end
end
