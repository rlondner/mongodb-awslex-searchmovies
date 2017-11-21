MONGODB_URI="\"mongodb://localhost:27017/moviesDB\""
lambda-local -l lambda.js -e event.json -E {\"MONGODB_URI\":$MONGODB_URI}