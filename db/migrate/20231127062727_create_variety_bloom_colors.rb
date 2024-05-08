class CreateVarietyBloomColors < ActiveRecord::Migration[7.0]
  def change
    create_table :variety_bloom_colors do |t|

      t.timestamps
    end
  end
end
