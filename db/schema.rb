# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.0].define(version: 2023_11_26_054706) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "bloom_colors", force: :cascade do |t|
    t.string "color", null: false
    t.string "hex"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "fc_photos", force: :cascade do |t|
    t.string "location"
    t.string "attribution"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "variety_id", null: false
    t.string "photoID"
    t.integer "recNumFC"
    t.index ["variety_id"], name: "index_fc_photos_on_variety_id"
  end

  create_table "varieties", force: :cascade do |t|
    t.string "name", null: false
    t.string "english"
    t.string "regNum"
    t.string "hybridizer"
    t.string "blossom"
    t.string "foliage"
    t.string "habit"
    t.string "addInfo"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.date "regDate"
    t.integer "recNumFC"
  end

  add_foreign_key "fc_photos", "varieties"
end
