namespace :varieties do
  desc "Seeds bloom colors and hex codes"
  task seed_bloom_colors: :environment do
    BloomColor.create!([
    {
       color: "Pink",
       hex: "FFC0CB"
    },
    {
      color: "White",
      hex: "FFFFFF"
    },
    {
      color: "Blue",
      hex: "0000FF"
    },
    {
      color: "Lavender",
      hex: "E6E6FA"
    },
    {
      color: "Orchid",
      hex: "DA70D6"
    },
    {
      color: "Purple",
      hex: "800080"
    },
    {
      color: "Lilac",
      hex: "DCD0FF"
    },
    {
      color: "Red",
      hex: "FF0000"
    },
    {
      color: "Coral",
      hex: "FF7F50"
    },
    {
      color: "Fuchsia",
      hex: "FF77FF"
    },
    {
      color: "Burgundy",
      hex: "800020"
    },
    {
      color: "Cream",
      hex: "FFFDD0"
    },
    {
      color: "Rose",
      hex: "FF007F"
    },
    {
      color: "Magenta",
      hex: "FF00FF"
    },
    {
      color: "Green",
      hex: "008000"
    },
    {
      color: "Gold",
      hex: "FFD700"
    },
    {
      color: "Yellow",
      hex: "FFFF00"
    },
    {
      color: "Raspberry",
      hex: "E30B5C"
    },
    {
      color: "Peach",
      hex: "FFDAB9"
    },
    {
      color: "Wine",
      hex: "F22F37"
    },
    {
      color: "Blush",
      hex: "E8C7C8"
    },
    {
      color: "Violet",
      hex: "EE82EE"
    },
    {
      color: "Ivory",
      hex: "FFFFF0"
    },
    {
      color: "Silver",
      hex: "C0C0C0"
    },
    {
      color: "Copper",
      hex: "B87333"
    }
                        ])

    puts "Created #{BloomColor.count} colors"
  end

end
