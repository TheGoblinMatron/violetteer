class RenameTypetoHabit < ActiveRecord::Migration[7.0]
  def change
    rename_column :varieties, :type, :habit
  end
end
