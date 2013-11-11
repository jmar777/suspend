var fs = require('fs'),
	semver = require('semver'),
	regenerator = require('regenerator'),
	spawn = require('child_process').spawn,
	mochaArgs = ['./node_modules/mocha/bin/mocha', '--reporter', 'list'];

// get our test files
var testFiles = fs.readdirSync(__dirname).filter(function(fileName) {
	return fileName.slice(-3) === '.js' && !/(?:^run|\.es5)\.js$/.test(fileName);
}).map(function(fileName) {
	return './test/' + fileName;
});

// check if we're running with --harmony-generators or regenerator
if (semver.gte(process.version, '0.11.2')) {
	console.log('Running tests with --harmony-generators...');
	mochaArgs = mochaArgs.concat(['--harmony-generators']).concat(testFiles);
} else {
	console.log('Running tests with regenerator...')
	// regenerate generator code to *.es5.js files
	testFiles.forEach(function(fileName) {
		console.log('Regenerating file:', fileName);
		var fileContents = fs.readFileSync(fileName, 'utf-8'),
			es5Name = fileName.replace(/\.js$/, '.es5.js'),
			regenerated = regenerator(fileContents, { includeRuntime: true });
		fs.writeFileSync(es5Name, regenerated);
		mochaArgs.push(es5Name);
	});
}

// run the tests with mocha
spawn('node', mochaArgs, {
	stdio: 'inherit'
}).on('exit', function(err) {
	if (err) {
		console.error('process exited abnormally:', err);
		process.exit(typeof err === 'number' ? err : -1);
	}
});
