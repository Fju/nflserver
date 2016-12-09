class Match {
	constructor(eid, week, date, homeTeam, awayTeam) {
		this.eid = eid;
		this.week = week;
		this.date = date;
		this.homeTeam = homeTeam;
		this.awayTeam = awayTeam;
		
		this.quarter = "";
		this.gameClock = "";
		this.drives = {};

		this.over = false;
		this.crntdrv = null;
		this.updateKey = 0;
	}
	getJSON(params, updateKey) {
		var obj = {eid: this.eid};

		obj.date = this.date / 1000;
		obj.week = this.week;
		obj.upk = this.updateKey;
		obj.home = this.homeTeam.getJSON(params);
		obj.away = this.awayTeam.getJSON(params);
	
		if (params.drives) {
			obj.drives = [];
			for (var d in this.drives) {
				var currentDrive = this.drives[d];
				if (currentDrive.updateKey > updateKey) {
					obj.drives.push(currentDrive.getJSON(updateKey));
				}
			}			
		}

		if (this.crntdrv !== null) obj.crntdrv = this.crntdrv;

		obj.qtr = this.quarter;
		obj.clock = this.gameClock;
		
		return obj;
	}
}
class Team {
	constructor(abbr) {
		this.abbr = abbr;
		this.score = [];
		
		this.timeouts;
		this.stats = {};		
	}
	getJSON(params) {
		var obj = {abbr: this.abbr, score: this.score};

		if (this.timeouts) obj.to = this.timeouts;
		if (params.stats) obj.stats = this.stats;
		return obj;
	}
}
class Drive {
	constructor(id, posteam, postime, ydsgained, penyds, result) {
		this.id = id;
		this.posteam = posteam;
		this.postime = postime;
		this.ydsgained = ydsgained;
		this.penyds = penyds;
		this.result = result;
		this.plays = {};
		
		this.updateKey = 0;
	}
	getJSON(updateKey) {
		var obj = {postime: this.posteam, postime: this.postime, ydsgained: this.ydsgained, penyds: this.penyds, result: this.result};

		obj.plays = [];	
		for (var p in this.plays) {
			var currentPlay = this.plays[p];
			if (currentPlay.updateKey > updateKey) {
				obj.plays.push(currentPlay.getJSON());
			}
		}
		return obj;		
	}
}
class Play {
	constructor(id, qtr, time, down, ydstogo, yrdln, description) {
		this.id = id;
		this.qtr = qtr;
		this.time = time;
		this.down = down;
		this.ydstogo = ydstogo;
		this.yrdln = yrdln;
		this.description = description;
		
		this.updateKey = 0;
	}
	getJSON() {
		var obj = {qtr: this.qtr, time: this.time, down: this.down, ydstogo: this.ydstogo, yrdln: this.yrdln, desc: this.description};
		return obj;
	}
}

module.exports = {
	Match: Match,
	Team: Team,
	Drive: Drive,
	Play: Play
}
