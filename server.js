const xml = require("xml2js");
const time = require("time");

const schedule_url = "http://www.nfl.com/ajax/scorestrip?season=%1&seasonType=%2&week=%3";
const game_url = "http://www.nfl.com/liveupdate/game-center/%1/%1_gtd.json";

const http = require("http"), fs = require("fs");

const testEID = "2016111700";

let server = http.createServer(function (req, res) {
	console.log(req);
	
	
});
server.listen(5124);

var gameList = {};

class Match {
	constructor(eid, date, homeTeam, awayTeam) {
		this.eid = eid;
		this.date = date;
		this.homeTeam = homeTeam;
		this.awayTeam = awayTeam;
		
		this.quarter = "";
		this.gameClock = "";
		this.drives = [];		
	}
}
class Team {
	constructor(abbr) {
		this.abbr = abbr;
		this.score = [];
		
		this.timeouts;
		this.stats = {};		
	} 
}
class Drive {
	constructor(posteam, postime, ydsgained, penyds, result, plays) {
		this.posteam = posteam;
		this.postime = postime;
		this.ydsgained = ydsgained;
		this.penyds = penyds;
		this.result = result;
		this.plays = plays;
	}
}
class Play {
	constructor(qtr, time, down, ydstogo, yrdln, description) {
		this.qtr = qtr;
		this.time = time;
		this.down = down;
		this.ydstogo = ydstogo;
		this.yrdln = yrdln;
		this.description = description;
	}
}

function httpRequest(path, callback) {
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
	});
}

function updateSchedule(year, seasonType, week) {
	var path = schedule_url.replace("%1", year).replace("%2", seasonType).replace("%3", week);
	
	httpRequest(path, (data) => {
		xml.parseString(data, (err, result) => {
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

				currentMatch.homeTeam.abbr = xmlGame.h;
				currentMatch.homeTeam.score[0] = parseInt(xmlGame.hs);
				currentMatch.awayTeam.abbr = xmlGame.v;
				currentMatch.awayTeam.score[0] = parseInt(xmlGame.vs);
			
				if (xmlGame.q == "F") {
					currentMatch.qtr = "Final";
					currentMatch.gameClock = "";
				} else if (xmlGame.q == "F0") {
					currentMatch.qtr = "Final Overtime";
					currentMatch.gameClock = "";
				}
				
				gameList[eid] = currentMatch;
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
		} catch (e) {
			console.log(e);
		}
	});

}
//setInterval(updateCycle, 1000);
updateSchedule("2016", "REG", "11");
