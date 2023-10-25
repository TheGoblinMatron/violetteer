require 'csv'

namespace :copy do
    desc "imports varieties data from csv to postgres"
    task :data => :environment do
        def insert_variety
            varieties = []
            CSV.foreach("./lib/tasks/myplants.csv", headers: true) do |row|
                varieties << row
                puts row["name"]
            end
            time = Time.now.getutc

            Variety.copy_from_client [:name, :english, :hybridizer, :blossom, :foliage, :habit, :addInfo, :created_at, :updated_at] do |copy|
                varieties.each do |d|
                    copy << [d["name"], d["english"], d["hybridizer"], d["blossom"], d["foliage"], d["habit"], d["addInfo"], time, time]
                end
            end
        end

    insert_variety

    end

end