# Original Mongo Shell script from MongoDB Atlas
# mongo "mongodb://awslex-shard-00-00-q6bn0.mongodb.net:27017,awslex-shard-00-01-q6bn0.mongodb.net:27017,awslex-shard-00-02-q6bn0.mongodb.net:27017/test?replicaSet=awsLex-shard-0" --authenticationDatabase admin --ssl --username atlasAdmin --password <PASSWORD>

# Modified script to match expected mongorestore syntax
mongorestore --host  "awsLex-shard-0/awslex-shard-00-00-q6bn0.mongodb.net:27017,awslex-shard-00-01-q6bn0.mongodb.net:27017,awslex-shard-00-02-q6bn0.mongodb.net:27017" --authenticationDatabase admin --ssl --gzip --username atlasAdmin --password <PASSWORD>