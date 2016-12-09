const http = require("http");

var options = {
	port: 5124,
	method: "GET",
	headers: {
		"req-type": "Game",
		"eid": "2016120400",
		"update-key": 17
	}};


var req = http.request(options, (res) => {
	var data = "";
	res.setEncoding("utf8");
	res.on("data", (chunk) => {
		data += chunk;
	});
	res.on("end", () => {
		console.log(data);
	});
});
req.end();
