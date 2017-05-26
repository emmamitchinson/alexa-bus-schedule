var XMLHttpRequest  = require('xhr2');
var parseString = require('xml2js').parseString;
var xhttp = new XMLHttpRequest();

xhttp.open("GET", "http://transport.data.gov.uk/def/naptan/TramMetroUndergroundPlatform/instance.xml?_metadata=bindings&_view=all&min-easting=&_page=1", true);
xhttp.onreadystatechange = function() {
    if (this.readyState == 4) {
        response = xhttp.responseText;
        parseString(response, function (err, parsedResponse) {
            handleParsedResponse(parsedResponse);
        });
    }
}

var handleParsedResponse = function(parsedResponse) {
    // console.log(parsedResponse);
    var items = parsedResponse.result.items;
    items.forEach(function(item) {
        console.log(item.item[0].atcoCode);
    });
}


xhttp.overrideMimeType('text/xml');
xhttp.responseType = 'document';
xhttp.setRequestHeader("Content-Type", "text/xml");
xhttp.send();