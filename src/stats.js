const fs = require("fs");

const ALL = 0;
const PLAYER = 1;
const TEAM = 2;

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
		for (var i = 0; i != json.stats.length; i++) {
			var element = json.stats[i];
			this.stats[element.key] = new Stat().fromJSON(element);
		}

		return this;
	}
	getJSON() {
		var obj = {abbr: this.abbr, matches: this.matches, seasonResults: this.seasonResults};
		obj.stats = [];
		for (var key in this.stats) {
			obj.stats.push(this.stats[key].getJSON(true));
		}
		return obj;
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
		
		for (var i = 0; i != json.stats.length; i++) {
			var element = json.stats[i];
			if (typeof this.stats[element.category] === "undefined") this.stats[element.category] = {};
			this.stats[element.category][element.key] = new Stat().fromJSON(element);
		}
		
		return this;
	}
	getJSON() {
		var obj = {pid: this.pid, name: this.name, team: this.team, matches: this.matches};
		obj.stats = [];
		for (var cat in this.stats) {
			for (var key in this.stats[cat]) {
				obj.stats.push(this.stats[cat][key].getJSON());
			}
		}
		return obj;
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
	getJSON(isTeam) {
		var obj = {key: this.key, value: this.value, amount: this.amount};
		if (isTeam) obj.category = this.category;
		return obj;
	}
}

function getStats(flag) {
	var obj = {};
	if (flag === ALL) {
		obj.teams = [];
		obj.players = [];
		for (var team in teamStats) obj.teams.push(teamStats[team].getJSON());
		for (var player in playerStats) obj.players.push(playerStats[player].getJSON());
	}

	return JSON.stringify(obj);
}

module.exports = {
	playerStats: playerStats,
	teamStats: teamStats,
	getStats: getStats,
	Team: Team,
	Player: Player,
	Stat: Stat,
	ALL: ALL	
};

