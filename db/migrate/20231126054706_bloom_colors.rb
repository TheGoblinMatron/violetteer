class BloomColors < ActiveRecord::Migration[7.0]
  def change
    create_table :bloom_colors do |t|
      t.string :color, null: false
      t.string :hex
      t.timestamps
    end
  end
end
