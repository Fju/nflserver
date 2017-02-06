const http = require("http"), fs = require("fs"), time = require("time");

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
				var obj = {currentWeek: Parser.currentWeek};
			
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
		res.statusCode = 200;
		res.end(data);
		console.log(data);
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
			Parser.currentWeek = json.currentWeek || 1;
			
			for (var eid in json.gameList) {
				var jsonObj = json.gameList[eid];
				Parser.addGameToList(new NFL.Match().fromJSON(jsonObj));	
			}
			Logging.log(Logging.INFO, "Successfully loaded database");
		} catch (e) {
			console.log(e);
		}
	} else Logging.log(Logging.WARN, "Couldn't find 'database' file");
	if (fs.existsSync("./statistics")) {
		try {
			result = fs.readFileSync("./statistics", "utf-8");
			json = JSON.parse(result);			
			var jsonTeam = json.teams, jsonPlayers = json.players;
			
			jsonTeam.forEach((element) => {
				Stats.teamStats[element.abbr] = new Stats.Team().fromJSON(element);
			});
			jsonPlayers.forEach((element) => {
				Stats.playerStats[element.pid] = new Stats.Player().fromJSON(element);
			});
		} catch (e) {
			console.log(e);
		}		
	} else Logging.log(Logging.WARN, "Couldn't find 'statistics' file");
}

function writeDatabase() {
	var obj = {lastUpdate: lastUpdate, currentWeek: Parser.currentWeek, gameList: Parser.gameList};
	console.log(obj.currentWeek);
	fs.writeFileSync("./database", JSON.stringify(obj));
	fs.writeFileSync("./statistics", Stats.getStats(Stats.ALL));
	Logging.log(Logging.INFO, "Succesfully saved files");
}

function exitHandler() {
	console.log(); //newline after ^C
	Logging.log(Logging.DEBUG, "Received quit signal...");
	writeDatabase();
	process.exit();
}

function doTasks(tasks, callback) {
	if (tasks.length !== 0) {
		var task = tasks[0];
		if (task.type === "schedule") {
			Parser.updateSchedule(task.param, () => {
				tasks.shift();
				doTasks(tasks, callback);
			});
		} else if (task.type === "game") {
			Parser.updateGame(task.param, () => {
				tasks.shift();				
				doTasks(tasks, callback);
			});
		}
	} else callback();
}

function updateCycle() {
	const currentTime = Date.now();
	
	Logging.log(Logging.DEBUG, "Starting update cycle...");
	var tasks = [];
	if (currentTime - lastUpdate > 1000 * 60 * 30) {		
		for (var i = Parser.getCurrentWeek(); i <= 25; i++) {
			tasks.push({type: "schedule", param: i});
		}
		lastUpdate = currentTime;
	} else {
		for (var eid in Parser.gameList) {
			var currentMatch = Parser.gameList[eid];
			if (!currentMatch.over && currentMatch.date - 30 * 60 * 1000 < currentTime) {
				tasks.push({type: "game", param: eid});
			}
		}
	}
	doTasks(tasks, () => {		
		var elapsed = Date.now() - currentTime;
		Logging.log(Logging.DEBUG, "Cycle ended. Time elapsed: " + elapsed + "ms");
		setTimeout(updateCycle, Math.max(5000 - elapsed, 0));
	});
}


function init() {
	process.on("SIGINT", exitHandler);
	readDatabase();
	updateCycle();
	server.listen(PORT);
}
init();

