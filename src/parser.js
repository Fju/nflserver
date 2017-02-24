const NFL = require("./nfl.js");
const Stats = require("./stats.js");
const request = require("request"), xml = require("xml2js"), time = require("time");

const schedule_url = "http://www.nfl.com/ajax/scorestrip?season=%1&seasonType=%2&week=%3";
const game_url = "http://www.nfl.com/liveupdate/game-center/%1/%1_gtd.json";

const YEAR = 2016;

var gameList = {};

function addGameToList(match) {
	gameList[match.eid] = match;
}

function getTeam(abbr) {
	switch (abbr) {
		case "JAC":
			return "JAX";
		default:
			return abbr;
	}
}

function updateSchedule(week, callback) {
	const currentTime = Date.now() - time.localtime().gmtOffset * 1000;	
	
	var weekNr = week, seasonType = "PRE";
	if (weekNr > 4) {
		weekNr -= 4;
		seasonType = "REG";
	}
	if (weekNr > 17) seasonType = "POST";
	if (weekNr == 21) weekNr++;

	var path = schedule_url.replace("%1", YEAR).replace("%2", seasonType).replace("%3", weekNr);
	request({method: "GET", uri: path, timeout: 2000}, (error, response, body) => {
		if (response.statusCode !== 200) return;
		xml.parseString(body, (err, result) => {
			var w = module.exports.currentWeek;

			if (typeof(result["ss"]) != "object") return;

			var rootXML = result["ss"]["gms"][0]["g"];

			for (var j = 0; j != rootXML.length; j++) {
				var xmlGame = rootXML[j]["$"], eid = xmlGame.eid;				

				if (!(eid in gameList)) gameList[eid] = new NFL.Match(eid, week, null, new NFL.Team(xmlGame.h), new NFL.Team(xmlGame.v));
				var currentMatch = gameList[eid];
				
				var rawTime = xmlGame.t.split(":"); //time (format hh:mm)
				
				var rawDate = new Date(parseInt(eid.substr(0, 4)), //year
						parseInt(eid.substr(4, 2)) - 1, //month (-1 since January has index 0)
						parseInt(eid.substr(6, 2)), //day
						parseInt(rawTime[0]) + 12, //hour
						parseInt(rawTime[1])); //minute

				currentMatch.date = rawDate.getTime() + (18000 + time.localtime().gmtOffset) * 1000; //UTC
				currentMatch.week = week;
			
				if (currentMatch.date < currentTime && week >= w) {
					w = week;
					if (j === rootXML.length - 1) w++;
				}
				if (xmlGame.hs !== "" && xmlGame.vs !== "") {
					currentMatch.homeTeam.abbr = getTeam(xmlGame.h);
					currentMatch.homeTeam.score[0] = parseInt(xmlGame.hs);
					currentMatch.awayTeam.abbr = getTeam(xmlGame.v);
					currentMatch.awayTeam.score[0] = parseInt(xmlGame.vs);
				}
				if (xmlGame.q === "F") {
					currentMatch.quarter = "Final";
					currentMatch.gameClock = "";
				} else if (xmlGame.q === "FO") {
					currentMatch.quarter = "Final Overtime";
					currentMatch.gameClock = "";
				}
				
				gameList[eid] = currentMatch;
			}
			module.exports.currentWeek = Math.min(w, 25);				
			callback();
		});		
	});
}



function updateGame(eid, callback) {		
	var path = game_url.replace(/%1/g, eid);
	request({method: "GET", uri: path, timeout: 2000}, (error, response, body) => {
		try {		
			var rootJSON = JSON.parse(body);
			if (typeof rootJSON[eid] !== "object") throw new Error("No object");
		
			if (!(eid in gameList)) gameList[eid] = new NFL.Match(eid, null, null, null); 
			var currentMatch = gameList[eid];

			const updateKey = rootJSON["nextupdate"];
			if (updateKey === currentMatch.updateKey) throw new Error();

			currentMatch.updateKey = updateKey;		
			rootJSON = rootJSON[eid];
		
			currentMatch.quarter = (rootJSON.qtr !== "final overtime") ? rootJSON.qtr : "Final OT";
			currentMatch.gameClock = rootJSON.clock;
			currentMatch.yl = rootJSON.yl;
			currentMatch.down = rootJSON.down;
			currentMatch.togo = rootJSON.togo;
			currentMatch.posteam = rootJSON.posteam;
			currentMatch.redzone = rootJSON.redzone;

			if (currentMatch.quarter.indexOf("Final") === 0) currentMatch.over = true;
		
			var currentDriveId;
			for (key in rootJSON) {
				var jsonObj = rootJSON[key];			
				switch (key) {
					case "home":
					case "away":
						var abbr = getTeam(jsonObj.abbr);
						var currentTeam = new NFL.Team(abbr);

						if (currentMatch.over) {
							if (typeof Stats.teamStats[abbr] === "undefined") Stats.teamStats[abbr] = new Stats.Team(abbr);
							var currentTeamStats = Stats.teamStats[abbr];								
							for (var statCategory in jsonObj.stats) {
								var jsonStatCategory = jsonObj.stats[statCategory];
								if (statCategory !== "team") { //player stats are handled differently
									for (var pid in jsonStatCategory) {
										var jsonStatPlayer = jsonStatCategory[pid];

										if (!(pid in Stats.playerStats)) Stats.playerStats[pid] = new Stats.Player(pid, jsonStatPlayer.name, abbr);
										var currentPlayer = Stats.playerStats[pid];
												
										if (!(statCategory in currentPlayer.stats)) currentPlayer.stats[statCategory] = {};
										for (var statKey in jsonStatPlayer) {
											if (statKey === "name") continue;
											if (!(statKey in currentPlayer.stats[statCategory])) currentPlayer.stats[statCategory][statKey] = new Stats.Stat(statKey, 0, statCategory);
											currentPlayer.stats[statCategory][statKey].add(jsonStatPlayer[statKey]);
										}
										currentPlayer.matches++;
									}
								} else { //than team stats	
									for (var teamKey in jsonStatCategory) {
										if (teamKey === "top") continue; //TODO: Add compatibility for `Time of Possession` string (e.g.: 15:00 or 3:28)
										if (!(teamKey in currentTeamStats.stats)) currentTeamStats.stats[teamKey] = new Stats.Stat(teamKey, 0, statCategory);
										currentTeamStats.stats[teamKey].add(jsonStatCategory[teamKey]);
									}
								}
							}
							currentTeamStats.matches++;
						}
						
						for (var statKey in jsonObj.stats.team) currentTeam.stats[statKey] = jsonObj.stats.team[statKey];
						for (qtr in jsonObj["score"]) {
							var val = parseInt(jsonObj["score"][qtr]);
							if (qtr == "T") currentTeam.score[0] = val;
							else currentTeam.score[parseInt(qtr)] = val;
						}
						currentTeam.timeouts = jsonObj.to;
												
						if (key == "home") currentMatch.homeTeam = currentTeam;
						else currentMatch.awayTeam = currentTeam;
						break;
					case "drives":
						var currentDrives = currentMatch.drives;
						for (did in jsonObj) {
							if (did == "crntdrv") {
								currentDriveId = jsonObj["crntdrv"];
								continue;
							}						
							var jsonDrive = jsonObj[did];
							var jsonPlays = jsonDrive["plays"];
							var currentDrive = new NFL.Drive(did, jsonDrive.posteam, jsonDrive.postime, jsonDrive.ydsgained,
								jsonDrive.penyds, jsonDrive.result);
													
							var updated = false;
							for (pid in jsonPlays) {
								var jsonPlay = jsonPlays[pid];
								var currentPlay = new NFL.Play(pid, jsonPlay.qtr, jsonPlay.time, jsonPlay.down, jsonPlay.ydstogo,
									jsonPlay.yrdln, jsonPlay.desc.replace(/\([0-9]*:[0-9]{1,2}\)\s/, ""));

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
					case "scrsummary":
						var currentScoringPlays = currentMatch.scoringPlays;
						for (spid in jsonObj) {
							if (spid in currentScoringPlays) continue;

							var jsonSp = jsonObj[spid];
							currentScoringPlays[spid] = new NFL.ScoringPlay(jsonSp.qtr, jsonSp.type, jsonSp.team, jsonSp.desc, updateKey);
						}
						currentMatch.scoringPlays = currentScoringPlays;					
						break;
				}
			}
			
			if (!currentMatch.over && currentDriveId !== 0) {			
				var cd = currentMatch.drives[currentDriveId];
				var maxPlay = 0;
				for (var p in cd.plays) {
					var i = parseInt(p);
					if (i > maxPlay) maxPlay = p;
				}
				
				var cp = cd.plays[p];
				
				currentMatch.crntdrv = cp.description;
			} else currentMatch.crntdrv = null;

			gameList[eid] = currentMatch;
		} catch (e) {
			//console.log(e);
		}
		callback();
	});
}

module.exports = {
	currentWeek: 1,
	gameList: gameList,
	addGameToList: addGameToList,
	updateSchedule: updateSchedule,
	updateGame: updateGame
};

