module.exports = function(grunt) {
	grunt.initConfig({
		jshint: {
			files: ['lib/suspend.js'],
			options: {
				camelcase: true,
				eqeqeq: true,
				es3: true,
				undef: true,
				unused: true,
				trailing: true,
				boss: true,
				browser: true,
				globals: {
					jQuery: true
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');
};