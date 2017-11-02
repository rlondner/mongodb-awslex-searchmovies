# Amazon Lex Search Movies App

## MongoDB Atlas setup

1. Make sure MongoDB 3.4 is installed on your machine (we will need it to restore the movie dataset to MongoDB Atlas)
1. Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas?jmp=adref) or sign in into your existing Atlas account.
1. From the __Clusters__ page, build a new cluster if you don't already have one (using the *Build a New Cluster* button). Since we'll use AWS technologies only available in the us-east-1 (N. Virginia) region (as of November 2017), it's best if you create a cluster using the AWS cloud provider in that region.
1. Select your cluster and press the *Connect* button. In the window that opens, click on *Connect with the Mongo Shell* and press the *Copy* button.
1. Paste the value into the `/data/restore.sh` script and replicate the modifications done from the original script into the modified script (adding the `--host` parameter, replacing `mongodb:/` with the `replicaSet` value and adding the `--gzip` parameter). Please check the [mongorestore documentation](https://docs.mongodb.com/manual/reference/program/mongorestore/) for additional information.
1. From the `data` folder, run the `restore.sh` script to restore the __moviesDB__ database into MongoDB Atlas.
1. To follow least privilege access best practices, it is highly recommended to create a specific database user with only read/write access to the __movies__ collection of the __moviesDB__ database (see [this screenshot](./../img/moviesRWuser.png) for an example)