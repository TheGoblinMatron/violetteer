class AddBloomColorToVarietyBloomColors < ActiveRecord::Migration[7.0]
  def change
    add_reference :variety_bloom_colors, :bloom_color, null: false, foreign_key: true
  end
end
