var fs = require("fs");
var semver = require("semver");
var spawn = require("child_process").spawn;
var regenerator = require("regenerator");

function convert(es6File, es5File, callback) {
	fs.readFile(es6File, "utf-8", function(err, es6) {
		if (err) {
			return callback(err);
		}

		fs.writeFile(es5File, regenerator(es6, {
			includeRuntime: true
		}), callback);
	});
}

var queue = [];
function enqueue(cmd, args) {
	queue.push({
		cmd: cmd,
		args: args || []
	});
}

function flush() {
	var entry = queue.shift();
	if (entry) {
		var cmd = entry.cmd;
		if (typeof cmd === "function") {
			if (cmd.length > 1) {
				// If the command accepts a parameter, let it call the
				// asyncCallback itself.
				cmd.apply(null, entry.args.concat(asyncCallback));
			} else {
				cmd.apply(null, entry.args);
				asyncCallback();
			}
		} else {
			spawn(cmd, entry.args, {
				stdio: "inherit"
			}).on("exit", asyncCallback);
		}
	}
}

function asyncCallback(err) {
	if (err) {
		console.error("process exited abnormally:", err);
		process.exit(typeof err === "number" ? err : -1);
	} else {
		process.nextTick(flush);
	}
}

enqueue(convert, [
	"./test/promises.js",
	"./test/promises.es5.js"
]);

enqueue(convert, [
	"./test/resume.js",
	"./test/resume.es5.js"
]);

enqueue(convert, [
	"./test/snafus.js",
	"./test/snafus.es5.js"
]);

if (semver.gte(process.version, "0.11.2")) {
	enqueue("echo", ["Running tests with --harmony-generators..."]);
	enqueue("mocha", [
		"--harmony-generators",
		"--reporter", "list",
		"./test/promises.js",
		"./test/resume.js",
		"./test/snafus.js",
	]);
}

enqueue("echo", ["Running tests with regenerator..."]);
enqueue("mocha", [
	"--reporter", "list",
	"./test/*.es5.js",
]);

flush();
