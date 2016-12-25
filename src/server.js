const http = require("http"),
	fs = require("fs");

const Parser = require("./parser.js");
const NFL = require("./nfl.js");
const Logging = require("./logging.js");
const Stats = require("./stats.js");

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
				var obj = {currentWeek: Parser.getCurrentWeek()};
				
				var weekStart = req.headers["week-start"] || "0",
					weekEnd = req.headers["week-end"] || "0";					

				weekStart = parseInt(weekStart);
				weekEnd = parseInt(weekEnd);
				
				var currentWeekOnly = (weekStart === 0 && weekEnd === 0);
				for (var eid in Parser.gameList) {
					var currentMatch = Parser.gameList[eid];
					var w = currentMatch.week;
					if ((currentWeekOnly && w === obj.currentWeek) || (w >= weekStart && w <= weekEnd)) {
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
	var result, json;
	if (fs.existsSync("./database")) {
		try {
			result = fs.readFileSync("./database", "utf-8");
			json = JSON.parse(result);

			lastUpdate = json.lastUpdate || 0;
			Parser.setCurrentWeek(json.currentWeek || 1);			
			for (var eid in json.gameList) {
				var jsonObj = json.gameList[eid];
				Parser.addGameToList(new NFL.Match().fromJSON(jsonObj));	
			}
		} catch (e) {
			console.log(e);
		}
	} else Logging.log(Logging.WARN, "Couldn't find 'database' file");
	if (fs.existsSync("./statistics")) {
		try {
			result = fs.readFileSync("./statistics", "utf-8");
			json = JSON.parse(result);			
			var jsonTeam = json.team, jsonPlayers = json.players;


		} catch (e) {
			console.log(e);
		}		
	} else Logging.log(Logging.WARN, "Couldn't find 'statistics' file");
}

function writeDatabase() {
	var obj = {lastUpdate: lastUpdate, currentWeek: Parser.getCurrentWeek(), gameList: Parser.gameList};
	var obj2 = {team: Stats.teamStats, players: Stats.playerStats};
	fs.writeFileSync("./database", JSON.stringify(obj));
	fs.writeFileSync("./statistics", JSON.stringify(obj2));
	Logging.log(Logging.INFO, "Succesfully saved files");
}

function exitHandler() {
	console.log(); //newline after ^C
	Logging.log(Logging.DEBUG, "Received quit signal...");
	writeDatabase();
	process.exit();
}

function updateCycle() {
	const currentTime = Date.now();
	
	try {
		if (currentTime - lastUpdate > 1000 * 60 * 30) {
			Logging.log(Logging.DEBUG, "Updating schedule");
			lastUpdate = currentTime;
			//Parser.updateSchedule(YEAR, Parser.getCurrentWeek(), 25);
			Parser.updateSchedule(YEAR, 20, 20);
		}

		Logging.log(Logging.DEBUG, "Updating live matches");
		for (var eid in Parser.gameList) {
			var currentMatch = Parser.gameList[eid];
			if (!currentMatch.over && currentMatch.date + 4 * 60 * 60 * 1000 < currentTime) {
				Parser.updateGame(eid);
			}
		}
		console.log(JSON.stringify(Stats.playerStats, null, "  "));		

		var timeElapsed = Math.max(UPDATE_TIME * 1000 - (Date.now() - currentTime), 0);
		Logging.log(Logging.DEBUG, "Next cycle in " + timeElapsed + "ms");
		setTimeout(updateCycle, timeElapsed);
	} catch (e) {
		console.log(e);
	}
}


function init() {
	process.on("SIGINT", exitHandler);
	readDatabase();
	updateCycle();
	server.listen(PORT);
}
init();

