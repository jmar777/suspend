var fs = require('fs'),
	path = require('path'),
	regenerator = require('regenerator'),
	spawn = require('child_process').spawn,
	mochaArgs = ['./node_modules/mocha/bin/mocha', '--reporter', 'list'];

// get our test files
var testDir = path.resolve(__dirname, '../test');
var testFiles = fs.readdirSync(testDir).filter(function(fileName) {
	return fileName.slice(-3) === '.js' && !/(?:^run|\.es5)\.js$/.test(fileName);
}).map(function(fileName) {
	return './test/' + fileName;
});

console.log('Running tests with regenerator...')
// regenerate generator code to *.es5.js files
testFiles.forEach(function(fileName) {
	var fileContents = fs.readFileSync(fileName, 'utf-8'),
		es5Name = fileName.replace(/\.js$/, '.es5.js').split('/').pop(),
		es5FileName = path.resolve(__dirname, es5Name);

	console.log('Regenerating file:', fileName)
	var regenerated = regenerator(fileContents, { includeRuntime: true });
	fs.writeFileSync(es5FileName, regenerated);
	mochaArgs.push(es5FileName);
});

// run the tests with mocha
spawn('node', mochaArgs, {
	stdio: 'inherit'
}).on('exit', function(err) {
	if (err) {
		console.error('process exited abnormally:', err);
		process.exit(typeof err === 'number' ? err : -1);
	}
});
