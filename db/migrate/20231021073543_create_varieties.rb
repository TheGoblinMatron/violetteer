class CreateVarieties < ActiveRecord::Migration[7.0]
  def change
    create_table :varieties do |t|
      t.string :name, null: false
      t.string :english
      t.string :regNum
      t.string :regDate
      t.string :hybridizer
      t.string :blossom
      t.string :foliage
      t.string :type
      t.string :addInfo

      t.timestamps
    end
  end
end
