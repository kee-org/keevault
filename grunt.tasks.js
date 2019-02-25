module.exports = function(grunt) {
    grunt.registerTask('build-web-app', [
        'gitinfo',
        'clean',
        'eslint',
        'copy:html',
        'copy:icons',
        'copy:sw',
        'copy:fonts',
        'webpack',
        // 'uglify',
        'sass',
        'postcss',
        'inline',
        // 'htmlmin',
        'copy:dist-icons',
        'copy:dist-sw',
        'string-replace'
    ]);
};
