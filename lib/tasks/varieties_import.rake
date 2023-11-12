#This thing imports from the "prettified" csv of a subset downloaded out of FC, NOT from the raw db 

require 'csv'

namespace :copy do
    desc "imports varieties data from myplants.csv"
    task :data => :environment do
        def insert_variety
            varieties = []
            CSV.foreach("./lib/tasks/myplants.csv", headers: true) do |row|
                puts row["name"]
                if not (row["regDate"]).blank?
                    monthRegDate = row["regDate"][0..1]
                    dayRegDate = row["regDate"][3..4]
                    yearRegDate = row["regDate"][6..9]
                    puts "#{dayRegDate}/#{monthRegDate}/#{yearRegDate}"
                    row["regDate"] = "#{dayRegDate}/#{monthRegDate}/#{yearRegDate}".to_date
                end
                varieties << row
            end
            time = Time.now.getutc

            Variety.copy_from_client [:name, :english, :regNum, :regDate, :hybridizer, :blossom, :foliage, :habit, :addInfo, :created_at, :updated_at] do |copy|
                varieties.each do |d|
                    copy << [d["name"], d["english"], d["regNum"], d["regDate"], d["hybridizer"], d["blossom"], d["foliage"], d["habit"], d["addInfo"], time, time]
                end
            end
        end

    insert_variety

    end

end