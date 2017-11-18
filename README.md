# Amazon Lex Search Movies App

## MongoDB Atlas setup

1. Make sure MongoDB 3.4 is installed on your machine (we will need it to restore the movie dataset to MongoDB Atlas)
1. Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas?jmp=adref) or sign in into your existing Atlas account.
1. From the __Clusters__ page, build a new cluster if you don't already have one (using the *Build a New Cluster* button). Since we'll use AWS technologies only available in the us-east-1 (N. Virginia) region (as of November 2017), it's best if you create a cluster using the AWS cloud provider in that region.
1. Select your cluster and press the *Connect* button. In the window that opens, click on *Connect with the Mongo Shell* and press the *Copy* button.
1. Paste the value into the `/data/restore.sh` script and replicate the modifications done from the original script into the modified script (adding the `--host` parameter, replacing `mongodb:/` with the `replicaSet` value and adding the `--gzip` parameter). Please check the [mongorestore documentation](https://docs.mongodb.com/manual/reference/program/mongorestore/) for additional information.
1. From the `data` folder, run the `restore.sh` script to restore the __moviesDB__ database into MongoDB Atlas.
1. To follow least privilege access best practices, it is highly recommended to create a specific database user with only read/write access to the __movies__ collection of the __moviesDB__ database (see [this screenshot](./../master/img/moviesRWuser.png) for an example)

## Amazon Lex chat bot setup

Review the setup instructions available in this [blog post](https://www.mongodb.com/blog/post/aws-lex-lambda-mongodb-atlas-movie-search-app-part-2)

## AWS Lambda function

This is the Lambda function used by our Lex chatbot to fulfill the intent and retrieve the list of movies featuring the  actor/actress specified by the user.

### Configuration

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com) and retrieve the connection string of the cluster containing your __moviesDB__ database and customize the username and password to match the credentials of a database user having read permissions on the __moviesDB__ database (i.e. `read@moviesDB` permissions) (as a best practice, do not use your Atlas administrator account).
1. In the [code/template.yaml](./code/template.yaml) file, fill out the `MONGODB_URI` environment variable with the connection string you just customized.

### Test

1. Install Docker on your machine
1. Install [SAM Local](https://github.com/awslabs/aws-sam-local#installation) on your machine
1. Run `sh sam-invoke.sh` from Terminal to test your Lambda function locally. You can customize the values of the `currentIntent` element of the [event.json](./code/event.json) file to test different values.

### Deployment

1. In AWS, create an S3 bucket. In [code/sam-package.sh](./code/sam-package.sh), replace `<S3-BUCKET-NAME>` with the name of the bucket you just created
1. In the following instructions, all the scripts use a `lex` profile so you can either:
    - create such a profile in your AWS credentials file. You will need to create an IAM user with the following permissions: `AWSLambdaFullAccess`, `AmazonLexFullAccess` and the custom permissions available in this [AWS Policy](./code/AWSPolicy.json) file.
    - or replace it with the `default` profile if your default AWS CLI user has full admin priviledges.
1. Run `sh package.sh` from Terminal to package your SAM package. This will package your SAM package and upload it to your S3 bucket.
1. Run `sh deploy.sh` from Terminal to deploy your SAM package to AWS Lambda and API Gateway
1. Once the script has completed (without errors), sign in into the AWS Console and navigate the [AWS Lambda](https://console.aws.amazon.com/lambda/home#/functions) section.
1. You should see a __*LexMovieSearch*__ Lambda function. Select it and use the [event.json](./code/event.json) file to create a test event and test that the Lambda function works.

## Lex bot fulfillment configuration

1. Once you have validated that your Lambda function works, navigate back to the [AWS Lex](https://console.aws.amazon.com/lex) home.
1. Select the __*SearchMoviesBot*__ bot and in the *Fulfillment* section, select _AWS Lambda function_ and select the `LexMovieSearch` lambda function. An *Add permission to Lambda Function* window may pop up, press *OK* to confirm.
1. At the top of the page, press the *Build* button twice
1. Use the chat bot and enter the following prompt: __*Looking for a movie*__. This should kick off the _SearchMovies_ intent we just configured. You can then test the following answers to the consecutive questions prompted by the bot:
    - `cOmedY`
    - `anGeliNa JOLIE`
    - 0
1. You should get the following answer from the bot, coming right from your MongoDB Atlas database:

          Angelina Jolie played in the following comedy movies: Hackers (1995), Mojave Moon (1996), Playing by Heart (1998), Pushing Tin (1999), Life or Something Like It (2002), Mr. & Mrs. Smith (2005)
