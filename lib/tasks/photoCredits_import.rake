require 'csv'

namespace :copy do
    desc "This imports the attribution and photo file name info from the FC table photoCredits.csv"
    task :photoCredits => :environment do
        def insert_photo
            photosFC = []
            CSV.foreach("./lib/tasks/photoCredits.csv", headers: true) do |row|
                row["location"] = "fcPhotos/photos/#{row["photoID"]}.jpg"
                row["recNumFC"] = (row["photoID"][0..((row["photoID"].length)-2)]).to_i
                if not (row["attribution"]).blank?
                    row["attribution"] = row["attribution"].gsub("^", "'")
                    row["attribution"] = row["attribution"].gsub("~", ",")
                end
                varietyMatch = Variety.where(recNumFC: row["recNumFC"])
                row["varietyMatch"] = varietyMatch[0].id

                photosFC << row
            end


        
            time = Time.now.getutc

            puts time
            puts photosFC.length

             
            FcPhoto.copy_from_client [:photoID, :attribution, :recNumFC, :location, :variety_id, :created_at, :updated_at] do |copy|
                photosFC.each do |d|
                    copy << [d["photoID"], d["attribution"], d["recNumFC"], d["location"], d["varietyMatch"], time, time]
                end
            end

        end
        
    insert_photo

    end
end