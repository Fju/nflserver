const colors = require("colors");

const ERROR = 0, WARN = 1, INFO = 2, DEBUG = 3;

colors.setTheme({
	verbose: "cyan",
	success: "green",
	data: "grey",
	warn: "yellow",
	error: "red"
});

function log(subject, content) {
	var prefix = "";
	switch (subject) {
		case ERROR:
			prefix = "[ERR]".error;
			break;
		case WARN:
			prefix = "[WARN]".warn;
			break;
		case INFO:
			prefix = "[INFO]".data;
			break;
		case DEBUG:
			prefix = "[DEBUG]".verbose;
			break;
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
