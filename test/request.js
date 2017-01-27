const http = require("http"), syncRequest = require("sync-request");

var options = {
	method: "GET",
	hostname: "images.unsplash.com",
	path: "/photo-1423012373122-fff0a5d28cc9"
	};

var finished = false;

let server = http.createServer(function (req, res) {
	res.statusCode = 200;
	res.end("asdasdasd");
});
server.listen(27800);

syncRequest("GET", "https://" + options.hostname + options.path);


