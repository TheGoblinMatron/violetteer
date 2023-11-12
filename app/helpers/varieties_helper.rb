module VarietiesHelper
    def pretty_desc(variety)
        fullDesc = ""
        if not (variety.regNum).blank?
            fullDesc << "(#{variety.regNum})"
        end
        if not (variety.regDate).blank?
            regDateMDY = (variety.regDate).strftime("%m/%d/%Y")
            fullDesc << " #{regDateMDY}"
        end
        if not (variety.hybridizer).blank?
            fullDesc << " (#{variety.hybridizer})"
        end
        if not (variety.blossom).blank?
            fullDesc << " #{variety.blossom}"
        end
        if not (variety.foliage).blank?
            fullDesc << " #{variety.foliage}"
        end
        if not (variety.habit).blank?
            fullDesc << " #{variety.habit}"
        end
        fullDesc << " (#{variety.recNumFC})"
        return fullDesc
    end
end
