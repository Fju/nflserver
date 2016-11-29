const xml = require("xml2js"), http = require("http"), fs = require("fs"), syncRequest = require("sync-request");

const classes = require("./classes.js");
const Week = classes.Week, Match = classes.Match, Team = classes.Team, Drive = classes.Drive, Play = classes.Play;

const schedule_url = "http://www.nfl.com/ajax/scorestrip?season=%1&seasonType=%2&week=%3";
const game_url = "http://www.nfl.com/liveupdate/game-center/%1/%1_gtd.json";

const YEAR = 2016;

 
const PORT = 5124;

let server = http.createServer(function (req, res) {
	try {
		var updateKey = parseInt(req.headers.updateKey || "0"),
			state = parseInt(req.headers.state || "0"),
			eid = req.headers.eid || "";
		
		var data = "";
		if (eid in gameList) {
			data = gameList[eid].getJSON(state, updateKey);
			res.statusCode = 200;
		} else res.statusCode = 404;
		res.end(data);
	} catch (e) {
		console.log(e);
	}
});
server.listen(PORT);




var gameList = {};
var weekList = [];


var lastUpdate = 0;

function updateCycle() {
	const currentTime = Date.now();

	for (eid in gameList) {
		var currentMatch = gameList[eid];
		if (!currentMatch.over && currentMatch.date + 4 * 60 * 60 * 1000 < currentTime) {
			console.log("updating");
			updateGame(eid);			
		}
	}
}

function init() {
	console.log("Starting nflserver");
	updateSchedule(YEAR, 1, 17);
	console.log("Finished downloading schedule");
	updateCycle();
}
//init();



function updateSchedule(year, weekStart, weekEnd) {
	weekStart = weekStart || 1;
	weekEnd = weekEnd || 26;
	//0 - 3: Preseason Week 1 - Week 4
	//4 - 20: Regular Season Week 1 - Week 17
	//21 - 24: Post Season Week 18 - Week 20 & Week 22
	for (var i = weekStart, seasonType = "PRE"; i < weekEnd; i++) {
		var week = i;
		
		if (i > 4) {
			week -= 4;
			seasonType = "REG";
		}
		if (week > 17) seasonType = "POST";
		if (week == 21) week++;
	
		var path = schedule_url.replace("%1", year).replace("%2", seasonType).replace("%3", week);
		var response = syncRequest("GET", path);
		
		xml.parseString(response.getBody(), (err, result) => {
			if (typeof(result["ss"]) != "object") return;

			var rootXML = result["ss"]["gms"][0]["g"];
		
			for (var i = 0; i != rootXML.length; i++) {
				var xmlGame = rootXML[i]["$"], eid = xmlGame.eid;				

				if (!(eid in gameList)) gameList[eid] = new Match(eid, null, new Team(xmlGame.h), new Team(xmlGame.v));
				var currentMatch = gameList[eid];
				
				var rawTime = xmlGame.t.split(":"); //time (format hh:mm)
				
				var rawDate = new Date(parseInt(eid.substr(0, 4)), //year
						parseInt(eid.substr(4, 2)) - 1, //month (-1 since January has index 0)
						parseInt(eid.substr(6, 2)), //day
						parseInt(rawTime[0]), //hour
						parseInt(rawTime[1])); //minute

				currentMatch.date = rawDate.getTime();

				if (xmlGame.hs !== "" && xmlGame.vs !== "") {
					currentMatch.homeTeam.abbr = xmlGame.h;
					currentMatch.homeTeam.score[0] = parseInt(xmlGame.hs);
					currentMatch.awayTeam.abbr = xmlGame.v;
					currentMatch.awayTeam.score[0] = parseInt(xmlGame.vs);
				}

				if (xmlGame.q === "F") {
					currentMatch.qtr = "Final";
					currentMatch.gameClock = "";
				} else if (xmlGame.q === "FO") {
					currentMatch.qtr = "Final Overtime";
					currentMatch.gameClock = "";
				}
				
				gameList[eid] = currentMatch;
			}
		});
	}
}
function updateGame(eid, callback) {	
	var path = game_url.replace(/%1/g, eid);

	var response = syncRequest("GET", path);

	try {
		var rootJSON = JSON.parse(response.getBody())[eid];
	
		if (!(eid in gameList)) gameList[eid] = new Match(eid, null, null, null); 
		var currentMatch = gameList[eid];
		var updateKey = ++currentMatch.updateKey;
		
		for (key in rootJSON) {
			var jsonObj = rootJSON[key];
			switch (key) {
				case "home":
				case "away":
					var currentTeam = new Team(jsonObj.abbr);
					var jsonTeamStats = jsonObj["stats"]["team"];
					
					for (qtr in jsonObj["score"]) {
						var val = parseInt(jsonObj["score"][qtr]);
						if (qtr == "T") currentTeam.score[0] = val;
						else currentTeam.score[parseInt(qtr)] = val;
					}
					for (stat in jsonTeamStats) {
						currentTeam.stats[stat] = jsonTeamStats[stat];
					}
					currentTeam.timeouts = jsonObj.to;
											
					if (key == "home") currentMatch.homeTeam = currentTeam;
					else currentMatch.awayTeam = currentTeam;
					break;
				case "drives":
					var currentDrives = currentMatch.drives;
					for (did in jsonObj) {
						if (did == "crntdrv") continue;
						
						var jsonDrive = jsonObj[did];
						var jsonPlays = jsonDrive["plays"];
						var currentDrive = new Drive(did, jsonDrive.posteam, jsonDrive.postime, jsonDrive.ydsgained,
							jsonDrive.penyds, jsonDrive.result);
						
						var updated = false;
						for (pid in jsonPlays) {
							var jsonPlay = jsonPlays[pid];
							var currentPlay = new Play(pid, jsonPlay.qtr, jsonPlay.time, jsonPlay.down, jsonPlay.ydstogo,
								jsonPlay.yrdln, jsonPlay.desc);

							if (pid in currentDrive.plays) continue;

							currentPlay.updateKey = updateKey;
							currentDrive.plays[pid] = currentPlay;
							updated = true;
						}
						
						if (updated || !(did in currentMatch.drives)) {
							currentDrive.updateKey = updateKey;
							currentMatch.drives[did] = currentDrive;
						}					
					}									
					break;
			}					
		}
		currentMatch.quarter = rootJSON.qtr;
		currentMatch.gameClock = rootJSON.clock;

		if (currentMatch.quarter.indexOf("Final") === 0) {
			currentMatch.over = true;
		}

		currentMatch.updateID++;		
		gameList[eid] = currentMatch;
	} catch (e) {
		console.log(e);
	}
}
