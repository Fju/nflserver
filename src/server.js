const http = require("http"),
	fs = require("fs");

const Parser = require("./parser.js");
const NFL = require("./nfl.js");
const Logging = require("./logging.js");

const YEAR = 2016;
const PORT = 5124;
const UPDATE_TIME = 5; //5 seconds

var lastUpdate = 0;

let server = http.createServer(function (req, res) {
	console.log(req.headers);
	try {
		const reqType = req.headers["req-type"];
		var data = "{}";
		switch (reqType) {
			case "Schedule":
				var obj = {currentWeek: Parser.currentWeek};
				
				var weekStart = req.headers["week-start"] || "0",
					weekEnd = req.headers["week-end"] || "0";					

				weekStart = parseInt(weekStart);
				weekEnd = parseInt(weekEnd);
				
				var currentWeekOnly = (weekStart === 0 && weekEnd === 0);
				for (var eid in Parser.gameList) {
					var currentMatch = Parser.gameList[eid];
					var w = currentMatch.week;
					if ((currentWeekOnly && w === currentWeek) || (w >= weekStart && w <= weekEnd)) {
						obj[currentMatch.eid] = currentMatch.getJSON({crntdrv: true}, 0);
					}
				}
				data = JSON.stringify(obj);				
				break;
			case "Game":
				var obj = {};
				var eid = req.headers["eid"] || "",
					updateKey = req.headers["update-key"] || "0";
			
				updateKey = parseInt(updateKey);

				if (eid in Parser.gameList) {
					obj[eid] = Parser.gameList[eid].getJSON({drives: true, stats: true, crntdrv: true}, updateKey);
				}
				data = JSON.stringify(obj);				
				break;
			case "Score":
				var obj = {};
				var eid = req.headers["eid"] || "",
					updateKey = req.headers["update-key"] || "0";
				
				updateKey = parseInt(updateKey);
				
				if (eid in Parser.gameList) {
					obj[eid] = Parser.gameList[eid].getJSON({scoreOnly: true}, updateKey);
				}	
				data = JSON.stringify(obj);
				break;
			default:
				throw new Error("No request type!");
		}

		if (data === "{}") throw new Error("No data");
		console.log(data);
		res.statusCode = 200;
		res.end(data);
	} catch (e) {
		res.statusCode = 404;
		res.end(e.message);
		console.log(e);
	}
});

function readDatabase() {
	Logging.log(Logging.INFO, "Reading database");
	if (!fs.existsSync("./database")) {
		Logging.log(Logging.WARN, "Couldn't find database file!");	
		return;
	}
	var result = fs.readFileSync("./database", "utf-8");
	var json = JSON.parse(result);
	try {
		lastUpdate = json.lastUpdate || 0;
		Parser.currentWeek = json.currentWeek || 1;
					
		for (var eid in json.gameList) {
			var jsonObj = json.gameList[eid];
			Parser.addGameToList(new NFL.Match().fromJSON(jsonObj));	
		}
	} catch (e) {
		console.log(e);
	}
	Logging.log(Logging.INFO, "Finished reading database");	
}

function writeDatabase() {
	var obj = {lastUpdate: lastUpdate, currentWeek: Parser.currentWeek, gameList: Parser.gameList};
	fs.writeFileSync("./database", JSON.stringify(obj));
}

function exitHandler() {
	console.log();
	Logging.log(Logging.INFO, "Exiting");
	writeDatabase();
	process.exit();	
}

function updateCycle() {
	const currentTime = Date.now();

	if (currentTime - lastUpdate > 1000 * 60 * 60 * 6) {
		Logging.log(Logging.DEBUG, "Updating schedule");
		lastUpdate = currentTime;
		Parser.updateSchedule(YEAR, Parser.currentWeek, 26);
	}

	Logging.log(Logging.DEBUG, "Updating live matches");
	for (var eid in Parser.gameList) {
		var currentMatch = Parser.gameList[eid];
		if (!currentMatch.over && currentMatch.date + 4 * 60 * 60 * 1000 < currentTime) {
			Parser.updateGame(eid);
		}
	}

	var timeElapsed = Math.max(UPDATE_TIME * 1000 - (Date.now() - currentTime), 0);
	Logging.log(Logging.DEBUG, "Next cycle in " + timeElapsed + "ms");
	setTimeout(updateCycle, timeElapsed);
}


function init() {
	process.on("SIGINT", exitHandler);
	readDatabase();
	updateCycle();
	server.listen(PORT);
}
init();

