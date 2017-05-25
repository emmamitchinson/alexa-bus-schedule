var XMLHttpRequest  = require('xhr2');
var parseString = require('xml2js').parseString;

var getJSON = function(i) {
    return new Promise(function(resolve, reject) {
        var xhttp = new XMLHttpRequest();
        xhttp.open("GET", "http://transport.data.gov.uk/def/naptan/TramMetroUndergroundPlatform/instance.json?_view=all&min-easting=&_page=" + i, true);
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4) {
                response = xhttp.responseText;
                try {
                    resolve(handleParsedResponse(JSON.parse(response)));
                }
                catch(err) {
                    reject(getJSON(i));
                }
                
            }
        }
        xhttp.send();
    });
}

var handleParsedResponse = function(response) {
    var items = response.result.items;
    var string = " (Manchester Metrolink)";
    items.forEach(function(item) {
        if (item.name.indexOf(string) >= 0) {
            var newKey = item.name.replace(string, "").toLowerCase();
            if (!stopArray[newKey]) {
                stopArray[newKey] = item.atcoCode;
            } else {
                stopArray[newKey] = [stopArray[newKey], item.atcoCode];
            }
            console.log(stopArray);
        }
    });
}

var stopArray = {};
for (i = 1; i <= 56; i++) {
    getJSON(i);
}