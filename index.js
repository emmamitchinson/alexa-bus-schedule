/**
 * NPM modules
 */

var XMLHttpRequest  = require("xmlhttprequest").XMLHttpRequest;
var Promise         = require("bluebird");

/**
 * Local files
 */

var AlexaSkill      = require("./AlexaSkill")
var metrolinkStops  = require("./dataAssets/metrolinkStops.json");
var metrolinkLines  = require("./dataAssets/metrolinkLines.json");

/**
 * Determine environment
 */

if ("undefined" === typeof process.env.DEBUG) {
  var APP_ID = process.env.APP_ID
}
else {
  APP_ID = null;
}

/**
* Tools
*/

var getIdByPrompt = function(prompt) {
  var metrolinkStopName = prompt.value.toLowerCase();

  if (metrolinkStops[metrolinkStopName]) {
    return metrolinkStops[metrolinkStopName];
  }

  return null;
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

var renderEta = function(eta) {
  if (eta == "1") {
    return "in 1 minute";
  } else if (eta == "0") {
    return "now";
  } else {
    return "in " + eta + " minutes"
  }
}

var renderDepartingTowards = function(finalStop) {
  return " departing towards " + finalStop + ". ";
}

/**
* Processes
*/

var sendMetrolinkGETRequest = function(stopId) {
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

var filterResponses = function(departureName, destinationName, serverResponses) {
  var filterResponses = [];

  for (i = 0; i < serverResponses.length; i++) {
    var tramInfo = serverResponses[i].fboard_result.fboard_events;
    for (x = 0; x < tramInfo.length; x++) {
      if (tramInfo[x].departing_to) {
        var finalStopOnLine = tramInfo[x].departing_to.toLowerCase();
      } else {
        break;
      }
    }

    for (j = 0; j < metrolinkLines.length; j++) {
      if (metrolinkLines[j].includes(departureName) && metrolinkLines[j].includes(destinationName)) {
        if (metrolinkLines[j].indexOf(finalStopOnLine) == 0) {
          if (metrolinkLines[j].indexOf(departureName) > metrolinkLines[j].indexOf(destinationName)) {
            filterResponses.push(serverResponses[i]);
            break;
          }
        } else if (metrolinkLines[j].indexOf(finalStopOnLine) == metrolinkLines[j].length - 1) {
          if (metrolinkLines[j].indexOf(departureName) < metrolinkLines[j].indexOf(destinationName)) {
            filterResponses.push(serverResponses[i]);
            break;
          }
        }
      }
    }
  }

  return filterResponses;
}

/**
 * NextMetrolinkFromA
 */

  var handleNextMetrolinkFromARequest = function(serverResponses, alexaResponse) {
    var cardText = "";

    var cleanedServerResponses = cleanArray(serverResponses);

    for (i = 0; i < cleanedServerResponses.length; i++) {
      var trams = cleanedServerResponses[i].fboard_result.fboard_events;
      for (j = 0; j < trams.length; j++) {
        if (j == 0) {
          cardText += "The next metro is " + renderEta(trams[j].eta) + renderDepartingTowards(trams[j].departing_to);
        }
        else if (j == 1) {
          cardText += "There's another metro " + renderEta(trams[j].eta) + renderDepartingTowards(trams[j].departing_to);
        }
        else if (j > 1 && cleanedServerResponses[i + 1]) {
          cardText += "Heading in the other direction: ";
          break;
        }
      }
    }

    if (cardText == "") {
      cardText = "There's currently no trams running from this stop";
    }
    
    return alexaResponse.tellWithCard(cardText, "", cardText);
  };

  var processGetNextMetrolinkFromAIntent = function(intent, session, response) {
    if (intent.slots.metrostop) {
      var stopId = getIdByPrompt(intent.slots.metrostop);
    } else if (intent.slots.metrostopA) {
    var stopId = getIdByPrompt(intent.slots.metrostopA);

    }
    if (stopId) {
      var promises = [];
      for (i = 1; i <= 4; i++) {
        var platformId = stopId + i;
        promises.push(sendMetrolinkGETRequest(platformId));
      }
      Promise.all(promises).then((requests) => {
          handleNextMetrolinkFromARequest(requests, response);
      });
    } else {
      response.ask("Sorry I can't find that metrostop, please try again.");
    }
  }

/**
 * NextMetrolinkFromAtoB
 */

  var handleNextMetrolinkFromAtoBRequest = function(intent, serverResponses, alexaResponse) {
    var cardText = "";
    var departureStopName = intent.slots.metrostopA.value;
    var destinationStopName = intent.slots.metrostopB.value;

    var cleanedServerResponses = cleanArray(serverResponses);
    var qualifyingResponses = filterResponses(departureStopName, destinationStopName, cleanedServerResponses);

    for (i = 0; i < qualifyingResponses.length; i++) {
      var trams = qualifyingResponses[i].fboard_result.fboard_events;
      for (j = 0; j < trams.length; j++) {
        if (j == 0) {
          cardText += "The next metro from " + departureStopName + " to " + destinationStopName + " is " + renderEta(trams[j].eta) + renderDepartingTowards(trams[j].departing_to);
        }
        else if (j == 1) {
          cardText += "There's another metro " + renderEta(trams[j].eta) + renderDepartingTowards(trams[j].departing_to);
        }
        else if (j > 1) {
          break;
        }
      }
    }
    if (cardText == "" && qualifyingResponses.length > 0) {
      cardText = "There's no direct trams between those two stops";
    }
    if (cardText == "") {
      cardText = "There's no trams currently running from that stop";
    }
    
    return alexaResponse.tellWithCard(cardText, "", cardText);
  };

  var processGetNextMetrolinkFromAtoBIntent = function(intent, session, response) {
    var departureStopId = getIdByPrompt(intent.slots.metrostopA);
    var destinationStopId = getIdByPrompt(intent.slots.metrostopB);

    if (departureStopId && destinationStopId) {
      var promises = [];
      for (i = 1; i <= 4; i++) {
        var departurePlatformId = departureStopId + i;
        promises.push(sendMetrolinkGETRequest(departurePlatformId));
      }
      Promise.all(promises).then((requests) => {
          handleNextMetrolinkFromAtoBRequest(intent, requests, response);
      });
    } 
    else if (departureStopId && !destinationStopId) {
      processGetNextMetrolinkFromAIntent(intent, session, response);
    }
    else {
      response.ask("Sorry I can't find that metrostop, please try again");
    }
  }

  var processGetNextMetrolinkIntent = function(intent, session, response) {
      var output = "Which Metrolink stop do you want to find more about?";

      response.ask(output);
  }

/**
* MetrolinkSchedule
*/

var MetrolinkSchedule = function(){
  AlexaSkill.call(this, APP_ID);
};

MetrolinkSchedule.prototype = Object.create(AlexaSkill.prototype);
MetrolinkSchedule.prototype.constructor = MetrolinkSchedule;

MetrolinkSchedule.prototype.eventHandlers.onSessionStarted = function(sessionStartedRequest, session){
  console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
      + ", sessionId: " + session.sessionId);
};

MetrolinkSchedule.prototype.eventHandlers.onLaunch = function(launchRequest, session, response){
  var output = "Welcome to Metrolink Schedule. " +
    "Say the name of a Metrolink stop to find out when the next metrolink will arrive.";

  var reprompt = "Which Metrolink stop are you travelling from?";

  response.ask(output, reprompt);

  console.log("onLaunch requestId: " + launchRequest.requestId
      + ", sessionId: " + session.sessionId);
};

MetrolinkSchedule.prototype.eventHandlers.onSessionEnded = function(sessionEndedRequest, session){
  console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
      + ", sessionId: " + session.sessionId);
};

MetrolinkSchedule.prototype.intentHandlers = {
  GetNextMetrolinkFromAtoBIntent: function(intent, session, response){
    processGetNextMetrolinkFromAtoBIntent(intent, session, response);
  },

  GetNextMetrolinkFromAIntent: function(intent, session, response){
    processGetNextMetrolinkFromAIntent(intent, session, response);
  },

  GetNextMetrolinkIntent: function(intent, session, response){
    processGetNextMetrolinkIntent(intent, session, response);
  },

  HelpIntent: function(intent, session, response){
    var speechOutput = "Get the tram times for any Metrolink stop. Which Metrolink stop would you like?";
    response.ask(speechOutput);
  }
};

exports.handler = function(event, context) {
    var skill = new MetrolinkSchedule();
    skill.execute(event, context);
};
