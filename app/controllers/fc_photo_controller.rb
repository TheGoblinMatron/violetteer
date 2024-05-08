class FcPhotosController < ApplicationController
    before_action :set_fc_photo, only: [:show]

    def show
    end


    private

    def set_fc_photo
        @fc_photo = FcPhoto.find(params[:id])
    end

    def fc_photo_params
        params.require(:fc_photo).permit(:name)
    end
end