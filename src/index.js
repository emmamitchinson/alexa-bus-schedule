var XMLHttpRequest  = require("xmlhttprequest").XMLHttpRequest;
var Promise         = require("bluebird");
var AlexaSkill      = require("./AlexaSkill")
var metrolinkStops  = require("../speechAssets/metrolinkStops.json");

if ("undefined" === typeof process.env.DEBUG) {
  var APP_ID = process.env.APP_ID
}
else {
  APP_ID = null;
}

/**
/ * Tools
/ */

var getIdsByPrompt = function(prompt) {
  var metrolinkStopName = prompt.value.toLowerCase();
  return metrolinkStops[metrolinkStopName];
}

var cleanArray = function(actual) {
  var newArray = new Array();
  for (var i = 0; i < actual.length; i++) {
    if (actual[i]) {
      newArray.push(actual[i]);
    }
  }
  return newArray;
}

/**
/ * Processes
/ */

var sendMetrolinkRequest = function(stopId) {
  return new Promise(function(resolve, reject) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "https://api.my.tfgm.com/proxy/execute?cid=optis:1&rid=metro_tram_board_v2&atco=" + stopId, true);
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4) {
        var nextTramsAsJSON = JSON.parse(xhttp.responseText);
        if (nextTramsAsJSON.msptl_response.server_response) {
          return resolve(nextTramsAsJSON.msptl_response.server_response);
        }
        return resolve(null);
      }
    }
    xhttp.send();
  });
}

var handleNextMetrolinkRequest = function(serverResponses, alexaResponse) {
  var cardText = "";

  var cleanedServerResponses = cleanArray(serverResponses);

  for (i = 0; i < cleanedServerResponses.length; i++) {
    if (serverResponses[i]) {
      var trams = serverResponses[i].fboard_result.fboard_events;
      if (i == 0) {
        cardText += "The next metro to " + trams[i].departing_to + " is in " + trams[i].eta + " minutes. ";
      }
      else if (i == 1) {
        cardText += "There's another metro to " + trams[i].departing_to + " in " + trams[i].eta + " minutes. ";
      }
      else if (i > 1) {
        cardText += "After that there's a metro " + trams[i].departing_to + " in " + trams[i].eta + " minutes. ";
      }
    }
  }

  if (cardText == "") {
    cardText = "There's currently no trams running from this stop";
  }
  
  return alexaResponse.tellWithCard(cardText, "", cardText);
};

var processIntent = function(intent, session, response) {
  var stopIds = getIdsByPrompt(intent.slots.metrostop);

  if (stopIds) {
    var promises = [];
    stopIds.forEach(function(stopId) {
      promises.push(sendMetrolinkRequest(stopId));
    }, this); 
    Promise.all(promises).then((requests) => {
        handleNextMetrolinkRequest(requests, response);
    });
  } else {
    response.tellWithCard("That metro stop no exist.", "", "That metro stop no exist.");
  }
}

var MetrolinkSchedule = function(){
  AlexaSkill.call(this, APP_ID);
};

/**
/ * MetrolinkSchedule
/ */

MetrolinkSchedule.prototype = Object.create(AlexaSkill.prototype);
MetrolinkSchedule.prototype.constructor = MetrolinkSchedule;

MetrolinkSchedule.prototype.eventHandlers.onSessionStarted = function(sessionStartedRequest, session){
  // What happens when the session starts? Optional
  console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
      + ", sessionId: " + session.sessionId);
};

MetrolinkSchedule.prototype.eventHandlers.onLaunch = function(launchRequest, session, response){
  // This is when they launch the skill but don"t specify what they want. Prompt
  // them for their Metrolink stop
  var output = "Welcome to Metrolink Schedule. " +
    "Say the name of a Metrolink stop to get how far the next Metrolink is away.";

  var reprompt = "Which Metrolink stop do you want to find more about?";

  response.ask(output, reprompt);

  console.log("onLaunch requestId: " + launchRequest.requestId
      + ", sessionId: " + session.sessionId);
};

MetrolinkSchedule.prototype.intentHandlers = {
  GetNextMetrolinkIntent: function(intent, session, response){
    processIntent(intent, session, response);
  },

  HelpIntent: function(intent, session, response){
    var speechOutput = "Get the distance from arrival for any Metrolink stop. " +
      "Which Metrolink stop would you like?";
    response.ask(speechOutput);
  }
};

exports.handler = function(event, context) {
    var skill = new MetrolinkSchedule();
    skill.execute(event, context);
};
