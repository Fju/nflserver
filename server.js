const schedule_url = "http://www.nfl.com/ajax/scorestrip?season=%d&seasonType=%s&week=%d";
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

function updateSchedule() {
	var path = schedule_url;
		
}
function updateGame(eid) {
	var path = game_url.replace(/%1/g, eid);

	http.get(path, (res) => {
		if (res.statusCode != 200) return;

		let rawData = "";
		res.setEncoding("utf8");

		res.on("data", (chunk) => rawData += chunk);
		res.on("end", () => {
			try {
				var rootJSON = JSON.parse(rawData)[eid];
			
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
					console.log(currentMatch);
				}				
			} catch (e) {
				console.log(e);
			}
		});
	});

}
//setInterval(updateCycle, 1000);
updateGame(testEID);
