class VarietiesController < ApplicationController
    before_action :set_variety, only: [:show]

    def index
        if params[:blossomcolor].present?
            @pagy, @varieties = pagy(Variety.where("blossom LIKE ?", "%#{params[:blossomcolor]}%").order(:regDate))
        else
            @pagy, @varieties = pagy(Variety.order(:regDate))
        end

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
