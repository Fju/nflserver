const fs = require("fs");


var playerStats = {};
var teamStats = {};

class Team {
	constructor(abbr) {
		this.abbr = abbr;

		this.stats = {};
		this.matches = 0;
		this.seasonResults = [0, 0, 0];
		/* this.conferenceResults = [0, 0, 0];
		this.divisionResults = [0, 0, 0]; */
	}
	fromJSON(json) {
		this.abbr = json.abbr;
		this.matches = json.matches;
		this.seasonResults = json.seasonResults;
		for (var key in json.stats) {
			this.stats[key] = new Stat().fromJSON(json.stats[cat][key]);
		}

		return this;
	}
}
class Player {
	constructor(pid, name, team) {
		this.pid = pid;
		this.name = name;
		this.team = team;

		this.stats = {};
		this.matches = 0;
	}
	fromJSON(json) {
		this.pid = json.pid;
		this.name = json.name;
		this.team = json.team;
		this.matches = json.matches;
		
		for (var cat in json.stats) {
			this.stats[cat] = {};
			for (var key in json.stats[cat]) {
				this.stats[cat][key] = new Stat().fromJSON(json.stats[cat][key]);
			}
		}

		return this;
	}
}
class Stat {
	constructor(key, value, category) {
		this.key = key;
		this.value = value;
		this.category = category;
		this.amount = 0;
	}
	add(val) {
		this.value += val;
		this.amount++;
	}
	average() {
		return value / amount;
	}
	fromJSON(json) {
		this.key = json.key;
		this.value = json.value;
		this.category = json.category;
		this.amount = json.amount;

		return this;
	}
}

function getStats() {

}

module.exports = {
	playerStats: playerStats,
	teamStats: teamStats,	
	Team: Team,
	Player: Player,
	Stat: Stat	
};

