Artgrid

1. Live Implementation
This project lives on a heroku server at https://damp-savannah-54651.herokuapp.com/

2. Offline Testing
This website is built on node.js and is hosted on Heroku. As such, my code doesn't translate 100% to being tested client-side, specifically the implementation of Postgres. I'm including the file latest.dump as a backup of my database as of 12/6. I personally never got my personal Postgres server to work, but ideally to run this on your own computer, you would want to create a Postgres server (preferably from the .dump file?) and set your DATABASE_URL environment variable to your server's url (postgresql://something). 
Once Postgres is set up, you can run the server by executing "node artgridserver" in the project directory, and navigating to localhost:8000 in a web browser. 