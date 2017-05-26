/**
 * NPM modules
 */

var XMLHttpRequest  = require("xmlhttprequest").XMLHttpRequest;
var Promise         = require("bluebird");

/**
 * Local files
 */

var AlexaSkill      = require("./AlexaSkill")
var metrolinkStops  = require("../speechAssets/metrolinkStops-2.json");
var metrolinkLines  = require("../speechAssets/metrolinkLines.json");
var POSTRequestData = require("../speechAssets/AtoBIntentPOSTRequest.json");

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
* Processes
*/

/**
 * NextMetrolinkFromA
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

  var handleNextMetrolinkFromARequest = function(serverResponses, alexaResponse) {
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

  var filterResponses = function(destinationName, serverResponses) {
    var filterResponses = [];

    for (i = 0; i < serverResponses.length; i++) {
      var tramInfo = serverResponses[i].fboard_result.fboard_events;
      var finalStopOnLine = tramInfo[i].departing_to.toLowerCase();

      for (j = 0; j < metrolinkLines.length; j++) {
        console.log(metrolinkLines[j]);
        if (metrolinkLines[j].includes(destinationName, finalStopOnLine)) {
          console.log(finalStopOnLine , destinationName);
          filterResponses.push(serverResponses[i]);
          break;
        }
      }
    }

    return filterResponses;
  }

  var handleNextMetrolinkFromAtoBRequest = function(intent, serverResponses, alexaResponse) {
    var cardText = "";
    var departureStopName = intent.slots.metrostopA.value;
    var destinationStopName = intent.slots.metrostopB.value;

    var cleanedServerResponses = cleanArray(serverResponses);

    var qualifyingResponses = filterResponses(destinationStopName, cleanedServerResponses);

    for (i = 0; i < qualifyingResponses.length; i++) {
      if (qualifyingResponses[i]) {
        var trams = qualifyingResponses[i].fboard_result.fboard_events;
        if (i == 0) {
          cardText += "The next metro from " + departureStopName + " to " + destinationStopName + " is in " + trams[i].eta + " minutes. ";
        }
        else if (i == 1) {
          cardText += "There's another metro in " + trams[i].eta + " minutes. ";
        }
        else if (i > 1) {
          console.log(i);
          cardText += "The metro after that is in " + trams[i].eta + " minutes. ";
        }
      }
    }

    if (cardText == "") {
      cardText = "There's currently no trams running from this stop";
    }
    
    return alexaResponse.tellWithCard(cardText, "", cardText);
  };

  var processGetNextMetrolinkFromAIntent = function(intent, session, response) {
    var stopId = getIdByPrompt(intent.slots.metrostop);

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
      response.tellWithCard("That metro stop no exist.", "", "That metro stop no exist.");
    }
  }

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
      response.tellWithCard("That metro stop no exist.", "", "That metro stop no exist.");
    }
  }

/**
 * NextMetrolinkFromAtoB

  var sendMetrolinkPOSTRequest = function(departureStopIds, destinationStopIds) {
    return new Promise(function(resolve, reject) {
      var xhttp = new XMLHttpRequest();
      xhttp.open("POST", "https://api.my.tfgm.com/proxy/execute?cid=optis:1&rid=getjps_v2", true);
      xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
          var nextTramsAsJSON = JSON.parse(xhttp.responseText);
          if (nextTramsAsJSON.msptl_response.server_response) {
            return resolve(nextTramsAsJSON.msptl_response.server_response);
          }
          return resolve(null);
        }
      }
      xhttp.send(JSON.stringify(POSTRequestData));
    });
  }

  var handleNextMetrolinkFromAtoBRequest = function(serverResponses, alexaResponse) {
    console.log(serverResponses);
    return alexaResponse.tellWithCard(serverResponses, "", serverResponses);
  };

  var processGetNextMetrolinkFromAtoBIntent = function(intent, session, response) {
    var departureStopIds = getIdsByPrompt(intent.slots.metrostopA);
    var destinationStopIds = getIdsByPrompt(intent.slots.metrostopB);

    if (departureStopIds && destinationStopIds) {
      var promises = [];
      departureStopIds.forEach(function(departureStopId) {
        destinationStopIds.forEach(function(destinationStopId) {
          promises.push(sendMetrolinkPOSTRequest(departureStopId, destinationStopId));
        }, this); 
      }, this);
      Promise.all(promises).then((requests) => {
          handleNextMetrolinkFromAtoBRequest(requests, response);
      });
    } else {
      response.tellWithCard("That metro stop no exist.", "", "That metro stop no exist.");
    }
  }
 */


var MetrolinkSchedule = function(){
  AlexaSkill.call(this, APP_ID);
};

/**
* MetrolinkSchedule
*/

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
  GetNextMetrolinkFromAtoBIntent: function(intent, session, response){
    processGetNextMetrolinkFromAtoBIntent(intent, session, response);
  },

  GetNextMetrolinkFromAIntent: function(intent, session, response){
    processGetNextMetrolinkFromAIntent(intent, session, response);
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
