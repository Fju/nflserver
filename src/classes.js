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

module.exports = {
	Match: Match,
	Team: Team,
	Drive: Drive,
	Play: Play
}
