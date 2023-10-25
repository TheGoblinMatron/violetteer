require "application_system_test_case"

class VarietiesTest < ApplicationSystemTestCase
  # test "visiting the index" do
  #   visit varieties_url
  #
  #   assert_selector "h1", text: "Varieties"
  # end
  setup do
    @variety = varieties(:one) 
  end

  test "Showing a variety" do
    visit varieties_path
    click_link @variety.name

    assert_selector "h1", text: @variety.name
  end
end
