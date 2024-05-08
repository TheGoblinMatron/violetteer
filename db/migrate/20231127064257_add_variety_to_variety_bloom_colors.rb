class AddVarietyToVarietyBloomColors < ActiveRecord::Migration[7.0]
  def change
    add_reference :variety_bloom_colors, :variety, null: false, foreign_key: true
  end
end
