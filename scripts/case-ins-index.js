use movies
db.movies.createIndex({"Cast":1}, {collation: {locale:'en', strength:1}})