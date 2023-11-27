class VarietiesController < ApplicationController
    before_action :set_variety, only: [:show]

    def index
        if params[:bloomcolor].present?
            @pagy, @varieties = pagy(Variety.where("blossom LIKE ?", "%#{params[:bloomcolor]}%").order(:regDate))
        else
            @pagy, @varieties = pagy(Variety.order(:regDate))
        end

        # if turbo_frame_request?
        #     render partial: "varieties", locals: { varieties: @varieties }
        # else
        #     render 'varieties/index'
        # end
    end

    def show
    end


    private

    def set_variety
        @variety = Variety.find(params[:id])
    end


    def variety_params
        params.require(:variety).permit(:name)
    end
end
