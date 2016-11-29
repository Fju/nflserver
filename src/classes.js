/*
 *  Syntax of `state`
 *  [ 0 ]   [ 1 ]   [ 0 ]   [ 1 ]  =  5
 *  stats   score   drives   misc
 *
 *  0: disabled    1: enabled
 */

class Week {
	constructor(index, eids) {
		this.index = index;
		this.eids = eids;
	}
}
class Match {
	constructor(eid, date, homeTeam, awayTeam) {
		this.eid = eid;
		this.date = date;
		this.homeTeam = homeTeam;
		this.awayTeam = awayTeam;
		
		this.quarter = "";
		this.gameClock = "";
		this.drives = {};

		this.over = false;
		this.updateKey = 0;
	}
	getJSON(state, updateKey) {
		var obj = {eid: this.eid};
		
		obj.upk = this.updateKey;
		obj.homeTeam = this.homeTeam.getJSON(state); //stats enabled
		obj.awayTeam = this.awayTeam.getJSON(state);
		
		if (state & 2) {
			//drives enabled
			obj.drives = [];
			for (var d in this.drives) {
				var currentDrive = this.drives[d];
				if (currentDrive.updateKey > updateKey) {
					obj.drives.push(currentDrive.getJSON(updateKey));
				}
			}			
		}

		if (state & 1) {
			//misc enabled
			obj.date = this.date;
			obj.qtr = this.quarter;
			obj.clock = this.gameClock;
		}

		return JSON.stringify(obj);
	}
}
class Team {
	constructor(abbr) {
		this.abbr = abbr;
		this.score = [];
		
		this.timeouts;
		this.stats = {};		
	}
	getJSON(state) {
		var obj = {abbr: this.abbr};

		if (this.timeouts) obj.to = this.timeouts;

		if (state & 4) obj.score = this.score;
		if (state & 8) obj.stats = this.stats;
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
