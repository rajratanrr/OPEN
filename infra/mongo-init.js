// Invoked only on first initialization of the development MongoDB volume.
db.createUser({user:'roadsaathi',pwd:process.env.MONGO_PASSWORD,roles:[{role:'readWrite',db:'roadsaathi'}]});
