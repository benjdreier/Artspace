###Artgrid

##1. Live Implementation
This project lives on a heroku server at https://damp-savannah-54651.herokuapp.com/

##2. Offline Testing
This website is built on node.js and is hosted on Heroku. As such, I'm not 100% sure how to get my code working outside of heroku, specifically the implementation of the Postgres database. I'm including the file latest.dump as a backup of my database as of 12/6. I personally never got my personal Postgres server to work, but ideally to run this on your own computer, you would want to create a Postgres server (preferably from the .dump file?) and set your DATABASE_URL environment variable to your server's url (postgresql://something).
To run the server, you'll need to install Node, if not already installed. To install Node, execute "brew install node"
Once Postgres is set up, you can run the server by executing "node artgridserver" in the project directory, and navigating to localhost:8000 in a web browser.

#2.5. Database Specification
The database consists of one table, called grids, which has 3 columns; id of type serial (unused for now), grid_data of type text to store the json grid data, and timestamp of type timestamp.

##3. Heroku Hosting
If instead you want to upload the project to Heroku yourself, follow the guide at https://devcenter.heroku.com/articles/deploying-nodejs. You won't have to initialize npm, create the package.json file, or create the start script. You will, however, have to provision a postgres database with heroku by executing "heroku addons:create heroku-postgresql:hobby-dev". Additionally, you'll have to change line 73 of frontend.js with the new url of the project, as hardcoding the url of the website was the only way I could figure to make the connection. 