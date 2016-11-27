const xml = require("xml2js"), http = require("http"), fs = require("fs"), request = require("request");

const classes = require("./classes.js");
const Match = classes.Match, Team = classes.Team, Drive = classes.Drive, Play = classes.Play;

const schedule_url = "http://www.nfl.com/ajax/scorestrip?season=%1&seasonType=%2&week=%3";
const game_url = "http://www.nfl.com/liveupdate/game-center/%1/%1_gtd.json";

const YEAR = 2016;

/* 
const PORT = 5124;

let server = http.createServer(function (req, res) {
	console.log(req.headers);
	
	
});
server.listen(PORT);
*/

var gameList = {};
var weekEids = {};


var lastUpdate = 0;
function updateCycle() {
	console.log("New Cycle");
	const currentTime = Date.now();
	if (lastUpdate === 0) lastUpdate = currentTime;
	
	if (currentTime - lastUpdate > 60 * 60 * 1000) {
		lastUpdate = currenTime;
		for (var i = 1, seasonType = "PRE", week = 1; i != 25; i++) {
			if (i == 5) {
				week -= 4;
				seasonType = "REG";
			}

			if (week > 17) seasonType = "POST";
			if (week == 20) week++;
			
			week++;
			updateSchedule(YEAR, seasonType, week);
		}
	}
	for (eid in gameList) {
		var currentMatch = gameList[eid];
		if (currentMatch.quarter.indexOf("Final") != 0 && currentTime > currentMatch.date - 30 * 60 * 1000) {
			console.log("UpdateGame: starting update for", eid);
			updateGame(eid);
		}
	}
}
setInterval(updateCycle, 15000);
updateCycle();


function httpRequest(path, callback) {
	request(path, (err, res, body) => {
		if (res.statusCode !== 200 || err) return;
		callback(body);
	});
	/*	
	http.get(path, (res) => {
		if (res.statusCode != 200) return;

		let rawData = "";
		res.setEncoding("utf8");
		res.on("data", (chunk) => {
			rawData += chunk
		});
		res.on("end", () => {
			callback(rawData);
		});
	}); */
}

function updateSchedule(year, seasonType, week) {
	var path = schedule_url.replace("%1", year).replace("%2", seasonType).replace("%3", week);
	
	httpRequest(path, (data) => {
		xml.parseString(data, (err, result) => {
			if (typeof(result["ss"]) != "object") return;

			var rootXML = result["ss"]["gms"][0]["g"];
		
			for (var i = 0; i != rootXML.length; i++) {
				var xmlGame = rootXML[i]["$"], eid = xmlGame.eid;				

				if (!(eid in gameList)) gameList[eid] = new Match(eid, null, new Team(xmlGame.h), new Team(xmlGame.v));
				var currentMatch = gameList[eid];
				
				var rawTime = xmlGame.t.split(":");					 	//time (format hh:mm)
				
				var rawDate = new Date(parseInt(eid.substr(0, 4)),		//year
						parseInt(eid.substr(4, 2)) - 1,					//month (-1 since January has index 0)
						parseInt(eid.substr(6, 2)),						//day
						parseInt(rawTime[0]),							//hour
						parseInt(rawTime[1]));							//minute

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
				
				if (weekEids[week] === undefined) weekEids[week] = [];
				weekEids[week].push(eid);
			}
		});
	});	
}
function updateGame(eid) {	
	var path = game_url.replace(/%1/g, eid);

	httpRequest(path, (data) => {	
		try {
			var rootJSON = JSON.parse(data)[eid];
		
			if (!(eid in gameList)) gameList[eid] = new Match(eid, null, null, null); 
			var currentMatch = gameList[eid];
			
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
						for (did in jsonObj) {
							if (did == "crntdrive") continue;

							var jsonDrive = jsonObj[did];
							var jsonPlays = jsonDrive["plays"];
							var currentDrive = new Drive(jsonDrive.posteam, jsonDrive.postime, jsonDrive.ydsgained,
								jsonDrive.penyds, jsonDrive.result, []);
							
							for (pid in jsonPlays) {
								var jsonPlay = jsonPlays[pid];
								var currentPlay = new Play(jsonPlay.qtr, jsonPlay.time, jsonPlay.down, jsonPlay.ydstogo,
									jsonPlay.yrdln, jsonPlay.desc);

								currentDrive.plays.push(currentPlay);
							}
							currentMatch.drives.push(currentDrive);
						}						
						break;
				}					
			}
			gameList[eid] = currentMatch;			
			console.log("UpdateGame: update for", eid, "successfully finished");
		} catch (e) {
			console.log(e);
		}
	});
}
