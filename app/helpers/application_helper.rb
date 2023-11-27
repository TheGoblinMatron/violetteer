module ApplicationHelper
  include Pagy::Frontend

=begin
  Apparently this asset exists check is an anti pattern. something something just open file and handle any exceptions.
  NTS: Do that if this goes anywhere
=end
  def asset_exist?(path)
    if Rails.configuration.assets.compile
      Rails.application.precompiled_assets.include? path
    else
      Rails.application.assets_manifest.assets[path].present?
    end
  end
end
