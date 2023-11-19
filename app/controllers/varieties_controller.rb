class VarietiesController < ApplicationController

    def index
        @varieties = Variety.order(:name).page params[:page]
    end

    def show
        @variety = Variety.find(params[:id])
    end


    private


    def variety_params
        params.require(:variety).permit(:name)
    end
end
