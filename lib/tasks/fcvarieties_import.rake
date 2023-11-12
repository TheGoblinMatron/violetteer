require 'csv'

namespace :copy do
    desc "Imports from FC database csv into varieties"
    task :varieties => :environment do
        def insert_variety
            varieties = []
            CSV.foreach("./lib/tasks/fcDB.csv", headers: true) do |row|
                # puts row["name"]

                row["name"] = row["name"].gsub("^","'")

                if not (row["blossom"]).blank?
                    row["blossom"] = row["blossom"].gsub("~", ",")
                end
                if not (row["foliage"]).blank?
                    row["foliage"] = row["foliage"].gsub("~", ",")
                end

                if not (row["regDate"]).blank?
                    if (row["regDate"].length) > 10
                        monthRegDate = row["regDate"][0..1]
                        dayRegDate = row["regDate"][3..4]
                        yearRegDate = row["regDate"][6..9]
                        # puts "#{dayRegDate}/#{monthRegDate}/#{yearRegDate}"
                        row["regDate"] = "#{dayRegDate}/#{monthRegDate}/#{yearRegDate}".to_date
                    else
                        row["regDate"] = row["regDate"].to_date
                    end
                end
                varieties << row
            end
            time = Time.now.getutc

            Variety.copy_from_client [:name, :english, :regNum, :regDate, :hybridizer, :blossom, :foliage, :habit, :addInfo, :recNumFC, :created_at, :updated_at] do |copy|
                varieties.each do |d|
                    copy << [d["name"], d["english"], d["regNum"], d["regDate"], d["hybridizer"], d["blossom"], d["foliage"], d["habit"], d["addInfo"], d["recNumFC"], time, time]
                end
            end
        end

    insert_variety

    end
end

