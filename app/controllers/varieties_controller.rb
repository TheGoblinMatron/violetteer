class VarietiesController < ApplicationController
    before_action :set_variety, only: [:show]

    def index
        @varieties = Variety.order(:name).page params[:page]
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
