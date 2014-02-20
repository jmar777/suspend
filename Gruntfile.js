module.exports = function(grunt) {
	grunt.initConfig({
		jshint: {
			files: ['lib/suspend.js'],
			options: {
				camelcase: true,
				eqeqeq: true,
				undef: true,
				unused: true,
				trailing: true,
				boss: true,
				browser: true,
				expr: true,
				globals: {
					module: true,
					setImmediate: true
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');
};
