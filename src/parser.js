const NFL = require("./nfl.js");
const Stats = require("./stats.js");
const syncRequest = require("sync-request"), xml = require("xml2js");

const schedule_url = "http://www.nfl.com/ajax/scorestrip?season=%1&seasonType=%2&week=%3";
const game_url = "http://www.nfl.com/liveupdate/game-center/%1/%1_gtd.json";

var currentWeek = 1;
var gameList = {};

function addGameToList(match) {
	gameList[match.eid] = match;
}

function getCurrentWeek() { return currentWeek; }
function setCurrentWeek(val) { currentWeek = val; }

function updateSchedule(year, weekStart, weekEnd) {
	const currentTime = Date.now();

	var w = 26;	
	weekStart = weekStart || 1;
	weekEnd = weekEnd || 25;
	//0 - 3: Preseason Week 1 - Week 4
	//4 - 20: Regular Season Week 1 - Week 17
	//21 - 24: Post Season Week 18 - Week 20 & Week 22
	for (var i = weekStart, seasonType = "PRE"; i <= weekEnd; i++) {
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

			for (var j = 0; j != rootXML.length; j++) {
				var xmlGame = rootXML[j]["$"], eid = xmlGame.eid;				

				if (!(eid in gameList)) gameList[eid] = new NFL.Match(eid, i, null, new NFL.Team(xmlGame.h), new NFL.Team(xmlGame.v));
				var currentMatch = gameList[eid];
				
				var rawTime = xmlGame.t.split(":"); //time (format hh:mm)
				
				var rawDate = new Date(parseInt(eid.substr(0, 4)), //year
						parseInt(eid.substr(4, 2)) - 1, //month (-1 since January has index 0)
						parseInt(eid.substr(6, 2)), //day
						parseInt(rawTime[0]), //hour
						parseInt(rawTime[1])); //minute

				currentMatch.date = rawDate.getTime();
				currentMatch.week = i;
			
				if (currentMatch.date > currentTime && i < w) {
					w = i;
					console.log("asd3", w);
				}
				if (xmlGame.hs !== "" && xmlGame.vs !== "") {
					currentMatch.homeTeam.abbr = xmlGame.h;
					currentMatch.homeTeam.score[0] = parseInt(xmlGame.hs);
					currentMatch.awayTeam.abbr = xmlGame.v;
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
		});
	}
	currentWeek = w;
	//console.log("asd", currentWeek);
}

function updateGame(eid) {	
	var path = game_url.replace(/%1/g, eid);
	var response = syncRequest("GET", path);

	try {
		var rootJSON = JSON.parse(response.getBody());
		if (typeof rootJSON[eid] !== "object") return;
	
		if (!(eid in gameList)) gameList[eid] = new NFL.Match(eid, null, null, null); 
		var currentMatch = gameList[eid];

		const updateKey = rootJSON["nextupdate"];
		if (updateKey === currentMatch.updateKey) return;

		currentMatch.updateKey = updateKey;		
		rootJSON = rootJSON[eid];
	
		currentMatch.quarter = (rootJSON.qtr !== "final overtime") ? rootJSON.qtr : "Final OT";
		currentMatch.gameClock = rootJSON.clock;
		if (currentMatch.quarter.indexOf("Final") === 0) {
			currentMatch.over = true;
		}
	
		var currentDriveId;
		for (key in rootJSON) {
			var jsonObj = rootJSON[key];			
			switch (key) {
				case "home":
				case "away":
					var abbr = jsonObj.abbr;
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
						currentScoringPlays[spid] = new NFL.ScoringPlay(jsonSp.type, jsonSp.team, jsonSp.desc, updateKey);
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
			
			currentMatch.crntdrv = {
				posteam: cd.posteam,
				down: cp.down,
				ydstogo: cp.ydstogo,
				yrdln: cp.yrdln,
				desc: cp.description				
			};
		} else currentMatch.crntdrv = null;

		gameList[eid] = currentMatch;
	} catch (e) {
		console.log(e);
	}
}

module.exports = {
	getCurrentWeek: getCurrentWeek,
	setCurrentWeek: setCurrentWeek,
	gameList: gameList,
	addGameToList: addGameToList,
	updateSchedule: updateSchedule,
	updateGame: updateGame
};

