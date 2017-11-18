"use strict";
var os = require('os');
var MongoClient = require("mongodb").MongoClient;
var uri = "mongodb://localhost:27017/IMDB";
var moviesCollection = "movies";
const allGenres = "All";
let cachedDb = null;

// Close dialog with the bot user, reporting fulfillmentState of Failed or Fulfilled ("In 2005, Angeline Jolie played in Mr. and Mrs. Smith")
function close(sessionAttributes, fulfillmentState, message) {
  return {
    sessionAttributes,
    dialogAction: {
      type: "Close",
      fulfillmentState,
      message
    }
  };
}

function delegate(sessionAttributes, slots) {
  return {
    sessionAttributes,
    dialogAction: {
      type: "Delegate",
      slots
    }
  };
}

// --------------- Events -----------------------

function dispatch(context, intentRequest, callback) {
  const sessionAttributes = intentRequest.sessionAttributes;
  const slots = intentRequest.currentIntent.slots;
  const slotDetails = intentRequest.currentIntent.slotDetails;
  const actor = slots.castMember;
  const genre = slots.genre;
  var jsonSlots = JSON.stringify(slots);
  var jsonSlotDetails = JSON.stringify(slotDetails);

  console.log(
    `request received for userId=${intentRequest.userId}, intentName=${intentRequest
      .currentIntent
      .name} with slots=${jsonSlots} and slotDetails=${jsonSlotDetails}`
  );

  if (genre != undefined && actor != undefined) {
    context.callbackWaitsForEmptyEventLoop = false;
    var mongoDBUri = process.env["MONGODB_URI"];
    try {
      //testing if the database connection exists and is connected to Atlas so we can try to re-use it
      if (cachedDb && cachedDb.serverConfig.isConnected()) {
        query(cachedDb, intentRequest, callback);
      } else {
        //some performance penalty might be incurred when running that database connection initialization code
        //console.log(`=> connecting to database ${mongoDBUri}`);
        MongoClient.connect(mongoDBUri, function(err, db) {
          if (err) {
            console.log(`the error is ${err}.`, err);
            process.exit(1);
          }
          cachedDb = db;
          return query(cachedDb, intentRequest, callback);
        });
      }
    } catch (err) {
      console.error("an error occurred", err);
    }
  }
}

function query(db, intentRequest, callback) {
  const sessionAttributes = intentRequest.sessionAttributes;
  const slots = intentRequest.currentIntent.slots;
  const actor = slots.castMember;
  const genre = slots.genre;
  var year = parseInt(slots.year.replace(/[^0-9]/g, ""), 10);
  console.log(`Searching for ${genre} movies with ${actor} in ${year}`);

  var actorMovies = "";
  var msgGenre = undefined;
  var msgYear = undefined;

  var query = {
    Cast: { $in: [actor] },
    Genres: { $not: { $in: ["Documentary", "News", ""] } },
    Type: "movie"
  };

  if (genre != undefined && genre != allGenres) {
    query.Genres = { $in: [genre] };
    msgGenre = genre.toLowerCase();
  }

  if ((year != undefined && isNaN(year)) || year > 1895) {
    query.Year = year;
    msgYear = year;
  }

  console.log(`query is ${JSON.stringify(query)}`);

  var resMessage = undefined;
  if (msgGenre == undefined && msgYear == undefined) {
    resMessage = `Sorry, I couldn't find any movie for ${actor}.`;
  }
  if (msgGenre != undefined && msgYear == undefined) {
    resMessage = `Sorry, I couldn't find any ${msgGenre} movie for ${actor}.`;
  }
  if (msgGenre == undefined && msgYear != undefined) {
    resMessage = `Sorry, I couldn't find any movie for ${actor} in ${msgYear}.`;
  }
  if (msgGenre != undefined && msgYear != undefined) {
    resMessage = `Sorry, ${actor} played in no ${msgGenre} movie in ${msgYear}.`;
  }

  db
    .collection(moviesCollection)
    .find(query, { _id: 0, Title: 1, Year: 1 })
    .collation({locale:'en', strength:1})//cf. https://docs.mongodb.com/manual/reference/collation
    .sort({ Year: 1 })
    .toArray(function(err, results) {
      if (err) {
        console.log(`Error querying the db: ${err}.`, err);
        process.exit(1);
      }
      if (results.length > 0) {
        for (var i = 0, len = results.length; i < len; i++) {
          actorMovies += `${results[i].Title} (${results[i].Year}), ${os.EOL}`;
        }
        //removing the last comma and space
        actorMovies = actorMovies.substring(0, actorMovies.length - 3);
        if (msgGenre != undefined) {
          resMessage = `${toTitleCase(actor)} played in the following ${msgGenre.toLowerCase()} movies: ${actorMovies}`;
        } else {
          resMessage = `${toTitleCase(actor)} played in the following movies: ${actorMovies}`;
        }
        if (msgYear != undefined) {
          resMessage = `In ${msgYear}, ` + resMessage;
        }
      }
      console.log(`${toTitleCase(actor)}'s ${msgGenre.toLowerCase()} movies are ${actorMovies}`);
      //db.close();
      callback(
        close(sessionAttributes, "Fulfilled", {
          contentType: "PlainText",
          content: resMessage
        })
      );
    });
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event, context, callback) => {
  try {
    if (event.bot.name !== "SearchMoviesBot") {
      callback("Invalid Bot Name");
      process.exit(1);
    }
    var jsonContents = JSON.parse(JSON.stringify(event));
    //handling API Gateway input where the event is embedded into the 'body' element
    if (event.body !== null && event.body !== undefined) {
      console.log("retrieving payload from event.body");
      jsonContents = JSON.parse(event.body);
    }
    dispatch(context, jsonContents, response => {
      callback(null, response);
    });
  } catch (err) {
    callback(err);
  }
};