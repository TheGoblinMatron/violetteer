Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
  # root "articles#index"
  resources :varieties do
    get '/page/:page', action: :index, on: :collection
  end
  resources :fc_photos

end
