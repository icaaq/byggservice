/*
 * assemble-bootstrap
 * http://github.com/assemble/assemble-bootstrap
 *
 * Copyright (c) 2013 Jon Schlinkert
 * MIT License
 */
"use strict";

module.exports = function(grunt) {

  var pretty = require('pretty');
  var vendor = grunt.file.readJSON('.bowerrc').directory;
  if(!grunt.file.exists(vendor + '/bootstrap/_config.yml')) {
    grunt.fail.fatal('>> Please run "bower install" before continuing.');
  }

  // Project configuration.
  grunt.initConfig({

    // Project metadata
    pkg   : grunt.file.readJSON('package.json'),
    site  : grunt.file.readYAML('_config.yml'),
    vendor: vendor,

    // Convenience
    bootstrap: '<%= vendor %>/bootstrap',

    // Run Bootstrap's own Gruntfile.
    subgrunt: {
      test: {
        options: {task: 'test'},
        src: ['<%= bootstrap %>']
      },
      js: {
        options: {task: 'concat'},
        src: ['<%= bootstrap %>']
      },
      css: {
        options: {task: 'less'},
        src: ['<%= bootstrap %>']
      },
      dist: {
        options: {task: 'dist'},
        src: ['<%= bootstrap %>']
      },
      all: {
        options: {task: 'default'},
        src: ['<%= bootstrap %>']
      }
    },

    // Regex for refactor task.
    replacements: require('./tasks/replacements'),

    // Refactor Liquid to Handlebars so we can
    // build with Assemble instead of Jekyll
    frep: {
      bootstrap: {
        options: {
          replacements: '<%= replacements.bootstrap %>'
        },
        files: [
          {expand: true, cwd: '<%= bootstrap %>', src: ['*.html', '_layouts/*.html', '_includes/*.html'], dest: 'templates/', ext: '.hbs'}
        ]
      },
      examples: {
        options: {
          replacements: '<%= replacements.examples %>'
        },
        files: [
          {expand: true, filter: 'isFile', cwd: '<%= bootstrap %>/examples', src: ['{*,**}/*.html'], dest: '<%= site.dest %>/examples/'}
        ]
      }
    },

    /**
    * gunt-contrib-watch
    */
    watch: {
        assemble: {
            files: ['templates/**/*.{md,hbs,json,yml}'],
            tasks: [
                'assemble:site'
            ]
        },
        js: {
            files: [
                'Gruntfile.js',
                'js/**/*.js',
                '!js/main.js'
            ],
            tasks: [
                'requirejs:single',
            ],
            options: {
                livereload: true,
            },
        },
        less: {
            files: [
                'theme/**/*.less'
            ],
            tasks: [
                'less',
            ],
            options: {
                livereload: true,
            },
        },
        livereload: {
            // Here we watch the files the sass task will compile to
            // These files are sent to the live reload server after sass compiles to them
            files: [
                '_site/assets/site.css',
                '_site/assets/bootstrap.css',
            ],
            options: {
                livereload: true
            }
        },
    },

    assemble: {
      options: {
        flatten: true,
        assets: '<%= site.assets %>',
        data: '<%= site.data %>/*.{json,yml}',

        // Metadata
        site: '<%= site %>',

        // Templates
        partials: '<%= site.includes %>',
        layoutdir: '<%= site.layouts %>',
        layout: '<%= site.layout %>',
      },
      site: {
        src: ['templates/*.hbs'],
        dest: '<%= site.dest %>/'
      }
    },


    // Compile LESS to CSS
    less: {
      options: {
        paths: [
          '<%= site.theme %>',
          '<%= site.theme %>/bootstrap',
          '<%= site.theme %>/components',
          '<%= site.theme %>/utils'
        ],
      },
      site: {
        src: ['<%= site.theme %>/site.less'],
        dest: '<%= site.assets %>/css/site.css'
      }
    },

    /**
    * grunt-contrib-requirejs
    */
    requirejs: {
        /* Official example build file: https://github.com/jrburke/r.js/blob/master/build/example.build.js */

        /* Will build 1 single file */
        single: {
            options: {
                baseUrl: 'js/src',
                mainConfigFile: 'js/src/config.js',
                paths: {
                    jquery: 'lib/amd-globals/jquery'
                },
                name: '../lib/require/almond',
                include: ['init'],
                insertRequire: ['init'],
                out: '_site/assets/js/main.js',
                generateSourceMaps: false,
                wrap: true,
                optimize: 'none'
            }
        }
    },

    copy: {
      vendor: {
        files: {
          '<%= site.assets %>/js/highlight.js': ['<%= vendor %>/highlightjs/highlight.pack.js'],
          '<%= site.assets %>/css/github.css':  ['<%= vendor %>/highlightjs/styles/github.css']
        }
      },
      assets: {
        files: [
          {expand: true, cwd: '<%= bootstrap %>/examples', src: ['**/*.css', '**/*.{jpg,png,gif}'], dest: '<%= site.dest %>/examples/'},
          {expand: true, cwd: '<%= bootstrap %>/docs-assets', src: ['**'], dest: '<%= site.assets %>/'},
          {expand: true, cwd: '<%= bootstrap %>/_data', src: ['**'], dest: '<%= site.data %>/'},
          {expand: true, cwd: '<%= bootstrap %>/dist', src: ['**'], dest: '<%= site.assets %>/'},
        ]
      },
      update: {
        files: [
          {expand: true, cwd: '<%= site.theme %>/img', src: ['**/*.{jpg,png,gif}'], dest: '<%= site.assets %>/img/'},
          {expand: true, cwd: '<%= bootstrap %>/less/mixins', src: ['*'], dest: '<%= site.theme %>/mixins/'},
          {expand: true, cwd: '<%= bootstrap %>/less', src: ['*', '!{var*,mix*,util*}'], dest: '<%= site.theme %>/bootstrap/'},
          {expand: true, cwd: '<%= bootstrap %>/less', src: ['{util*,mix*}.less'], dest: '<%= site.theme %>/utils'},
          {expand: true, cwd: '<%= bootstrap %>/less', src: ['variables.less'], dest: '<%= site.theme %>/'},
        ]
      }
    },

    clean: {
      dist: ['<%= site.dest %>/**/*', '!<%= site.dest %>/.{git,gitignore}'],
      update: ['<%= site.theme %>/bootstrap/{var*,mix*,util*}.less']
    }
  });

  grunt.config.set('site.description', 'Generated by http://assemble.io');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('assemble');
  grunt.loadNpmTasks('assemble-less');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-frep');
  grunt.loadNpmTasks('grunt-sync-pkg');
  grunt.loadNpmTasks('grunt-verb');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Load local "Subgrunt" task to run Bootstrap's Gruntfile.
  grunt.loadTasks('tasks');

  // Tests task.
  grunt.registerTask('test', ['subgrunt:test']);

  grunt.registerTask('live', [
    'watch'
  ]);

  grunt.registerTask('dev', ['clean', 'frep', 'assemble']);

  grunt.registerTask('update', ['copy:update', 'clean:update']);

  // Default task to be run with the "grunt" command.
  grunt.registerTask('default', [
    'clean',
    'subgrunt:js',
    'subgrunt:css',
    'requirejs',
    'copy',
    'frep',
    'assemble',
    'less',
    'sync'
  ]);
};
