"use strict";
var os = require("os");
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
  const castMember = slots.castMember;
  const genre = slots.genre;
  var year = parseInt(slots.year.replace(/[^0-9]/g, ""), 10);
  console.log(`Searching for ${genre} movies with ${castMember} in ${year}`);

  var castMemberMovies = "";
  var msgGenre = allGenres;
  var msgYear = undefined;
  var castArray = [castMember]
  //var castArray = [castMember, "Angelina Jolie"]

  var matchQuery = {
    Cast: { $in: castArray },
    Genres: { $not: { $in: ["Documentary", "News", ""] } },
    Type: "movie"
  };

  if (genre != undefined && genre != allGenres) {
    matchQuery.Genres = { $in: [genre] };
    msgGenre = genre.toLowerCase();
  }

  if ((year != undefined && isNaN(year)) || year > 1895) {
    matchQuery.Year = year;
    msgYear = year;
  }

  console.log(`query is ${JSON.stringify(matchQuery)}`);

  var resMessage = undefined;
  if (msgGenre == undefined && msgYear == undefined) {
    resMessage = `Sorry, I couldn't find any movie for ${castMember}.`;
  }
  if (msgGenre != undefined && msgYear == undefined) {
    resMessage = `Sorry, I couldn't find any ${msgGenre} movie for ${castMember}.`;
  }
  if (msgGenre == undefined && msgYear != undefined) {
    resMessage = `Sorry, I couldn't find any movie for ${castMember} in ${msgYear}.`;
  }
  if (msgGenre != undefined && msgYear != undefined) {
    resMessage = `Sorry, ${castMember} starred in no ${msgGenre} movie in ${msgYear}.`;
  }

  var aggregationFramework = true;
  var unwindStage = { $unwind: "$Cast"}
  var castFilterStage = { $match: {Cast: { $in: castArray } } }
  var collation = { locale: "en", strength: 1 };

  var moviesCount = 0;
  var yearSpan = 0;

  var cursor;

  if (aggregationFramework) {
    cursor = db.collection(moviesCollection).aggregate(
      [
        { $match: matchQuery },
        { $sort: { Year: 1 } },
        unwindStage,
        castFilterStage,
        { $group: {
            _id: "$Cast",
            allMoviesArray: {$push: {$concat: ["$Title", " (", { $substr: ["$Year", 0, 4] }, ")"] } },
            moviesCount: { $sum: 1 },
            maxYear: { $max: "$Year" },
            minYear: { $min: "$Year" }
          }
        },
        {
          $project: {
            moviesCount: 1,
            timeSpan: { $subtract: ["$maxYear", "$minYear"] },
            allMovies: {
              $reduce: {
                input: "$allMoviesArray",
                initialValue: "",
                in: {
                  $concat: [
                    "$$value",
                    {
                      $cond: {
                        if: { $eq: ["$$value", ""] },
                        then: "",
                        else: ", "
                      }
                    },
                    "$$this"
                  ]
                }
              }
            }
          }
        }
      ],
      {collation: collation} // cf. https://docs.mongodb.com/manual/reference/method/db.collection.aggregate/#specify-a-collation
    );
  } else {
    cursor = db
      .collection(moviesCollection)
      .find(matchQuery, { _id: 0, Title: 1, Year: 1 })
      .collation(collation) //cf. https://docs.mongodb.com/manual/reference/method/db.collection.find/#specify-collation
      .sort({ Year: 1 });
  }

  cursor.toArray(function(err, results) {
    if (err) {
      console.log(`Error querying the db: ${err}.`, err);
      process.exit(1);
    }
    if (results.length > 0) {
      console.log(`Raw results: ${JSON.stringify(results)}`)
      if (aggregationFramework) {
        for (var i = 0, len = results.length; i < len; i++) { 
          castMemberMovies = results[i].allMovies;
          moviesCount = results[i].moviesCount;
          yearSpan = results[i].timeSpan;
        }
      } 
      else {
        moviesCount = results.length;
        var maxYear, minYear;
        for (var i = 0, len = results.length; i < len; i++) { 
          castMemberMovies += `${results[i].Title} (${results[i].Year}), `;//${os.EOL}`;
        }
        var minYear, maxYear;
        minYear = results[0].Year
        maxYear = results[results.length-1].Year
        yearSpan = maxYear - minYear
        //removing the last comma and space
        castMemberMovies = castMemberMovies.substring(0, castMemberMovies.length - 2);
      }

      if (msgGenre != allGenres) {
        resMessage = `${toTitleCase(castMember)} starred in the following ${moviesCount>1?moviesCount+" ":""}${msgGenre.toLowerCase()} movie(s)${yearSpan>0?" over " + yearSpan +" years":""}: ${castMemberMovies}`;
      } else {
        resMessage = `${toTitleCase(castMember)} starred in the following ${moviesCount>1?moviesCount+" ":""}movie(s)${yearSpan>0?" over " + yearSpan +" years":""}: ${castMemberMovies}`;
      }
      if (msgYear != undefined) {
        resMessage = `In ${msgYear}, ` + resMessage;
      }
    }

    console.log(`Response message: ${resMessage}`)
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
