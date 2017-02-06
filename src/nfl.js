class Match {
	constructor(eid, week, date, homeTeam, awayTeam) {
		this.eid = eid;
		this.week = week;
		this.date = date;
		this.homeTeam = homeTeam;
		this.awayTeam = awayTeam;
		
		this.quarter = "";
		this.gameClock = "";
		this.yl = "";
		this.down = "";
		this.togo = "";
		this.posteam = "";
		this.redzone = false;

		this.drives = {};
		this.scoringPlays = {};

		this.over = false;
		this.crntdrv = null;
		this.updateKey = 0;
	}
	fromJSON(json) {
		this.eid = json.eid;
		this.week = json.week;
		this.date = json.date;
		this.quarter = json.quarter;
		this.gameClock = json.gameClock;
		this.yl = json.yl;
		this.down = json.down;
		this.togo = json.togo;
		this.posteam = json.posteam;
		this.redzone = json.redzone;

		this.over = json.over;
		this.crntdrv = json.crntdrv;
		this.updateKey = json.updateKey;

		this.homeTeam = new Team().fromJSON(json.homeTeam);
		this.awayTeam = new Team().fromJSON(json.awayTeam);
		
		for (var id in json.drives) {
			var jsonDrive = json.drives[id];
			this.drives[id] = new Drive().fromJSON(jsonDrive);
		}		
		for (var id in json.scoringPlays) {
			var jsonScoringPlays = json.scoringPlays[id];
			this.scoringPlays[id] = new ScoringPlay().fromJSON(jsonScoringPlays);
		}
		return this;	
	}
	getJSON(params, updateKey) {
		var obj = {eid: this.eid};

		if (params.scoreOnly) {
			obj.homeScore = this.homeTeam.score[0];
			obj.awayScore = this.awayTeam.score[0];
			obj.scrplays = [];
			for (var sp in this.scoringPlays) {
				var currentScoringPlay = this.scoringPlays[sp];
				if (currentScoringPlay.updateKey > updateKey) {
					obj.scrplays.push(currentScoringPlay.getJSON());
				}
			}
		} else {
			obj.date = this.date / 1000;
			obj.week = this.week;
			obj.home = this.homeTeam.getJSON(params);
			obj.away = this.awayTeam.getJSON(params);

			obj.qtr = this.quarter;
			obj.clock = this.gameClock;
			obj.yl = this.yl;
			obj.down = this.down;
			obj.togo = this.togo;
			obj.posteam = this.posteam;
			obj.redzone = this.redzone;
		}	
		if (params.drives) {
			obj.drives = [];
			for (var d in this.drives) {
				var currentDrive = this.drives[d];
				if (currentDrive.updateKey > updateKey) {
					var drv = currentDrive.getJSON(updateKey);
					obj.drives.push(drv);
				}
			}
		}
		if (this.crntdrv !== null && params.crntdrv) obj.crntdrv = this.crntdrv;

		obj.upk = this.updateKey;
		
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
	fromJSON(json) {
		this.abbr = json.abbr;
		this.score = json.score;
		this.timeouts = json.timeouts;
		this.stats = json.stats;

		return this;
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
	fromJSON(json) {
		this.id = json.id;
		this.posteam = json.posteam;
		this.postime = json.postime;
		this.ydsgained = json.ydsgained;
		this.penyds = json.penyds;
		this.result = json.result;
		this.updateKey = json.updateKey;
		
		for (var id in json.plays) {
			var jsonPlay = json.plays[id];
			this.plays[id] = new Play().fromJSON(jsonPlay);
		}
		return this;
	}
	getJSON(updateKey) {
		var obj = {posteam: this.posteam, postime: this.postime, ydsgained: this.ydsgained, penyds: this.penyds, result: this.result};

		obj.plays = [];	
		for (var p in this.plays) {
			var currentPlay = this.plays[p];
			if (currentPlay.updateKey > updateKey) {
				obj.plays.push(currentPlay.getJSON());
			}
		}
		if (obj.plays.length === 0) return null;
		return obj;
	}
}
class ScoringPlay {
	constructor(type, team, desc, updateKey) {
		this.type = type;
		this.team = team;
		this.description = desc;
		this.updateKey = updateKey;
	}
	fromJSON(json) {
		this.type = json.type;
		this.team = json.team;
		this.description = json.description;
		this.updateKey = json.updateKey;

		return this;
	}
	getJSON() {
		var obj = {type: this.type, team: this.team, desc: this.description};
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
	fromJSON(json) {
		this.id = json.id;
		this.qtr = json.qtr;
		this.time = json.time;
		this.down = json.down;
		this.ydstogo = json.ydstogo;
		this.yrdln = json.yrdln;
		this.description = json.description;
		this.updateKey = json.updateKey;

		return this;
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
	Play: Play,
	ScoringPlay: ScoringPlay
};

