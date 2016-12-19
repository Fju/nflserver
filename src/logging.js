const colors = require("colors");

const ERROR = 0, WARN = 1, INFO = 2, DEBUG = 3;

var level = 3;

colors.setTheme({
	verbose: ["cyan", "bold"],
	info: ["magenta", "bold"],
	time: "grey",
	warn: ["yellow", "bold"],
	error: ["red", "bold"]
});

function log(subject, content) {
	if (subject > level) return; //dont log
	var prefix = "";
	switch (subject) {
		case ERROR:
			prefix = "[ERR]".error;
			break;
		case WARN:
			prefix = "[WARN]".warn;
			break;
		case INFO:
			prefix = "[INFO]".info;
			break;
		case DEBUG:
			prefix = "[DEBUG]".verbose;
			break;
	}

	if (level === 3) {
		const now = Date.now();
		
		prefix = now.toString(16).time + " " + prefix; 
	}	
	console.log(prefix, content);
}

module.exports = {
	ERROR: ERROR,
	WARN: WARN,
	INFO: INFO,
	DEBUG: DEBUG,
	log: log
};
