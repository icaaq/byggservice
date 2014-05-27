/**
 * Main AMD Config.
 * Used both for runtime loading, testing and r.js builds
 *
 * For r.js bulds the 'bootstrapper' module needs to be included and required in grunt config for the app to start
 */

define(function () {
    'use strict';
    return require.config({

        paths: {
            jquery: 'lib/amd-globals/jquery',
            modernizr: 'lib/amd-globals/modernizr',
            document: 'lib/amd-globals/document',
            window: 'lib/amd-globals/window',
            options: 'core/options',

            pubsub: 'lib/pubsubjs/pubsub',
            breakpoints: 'lib/js-breakpoints',
            pubsubBreakpoints: 'core/pubsub-breakpoints',
            royalslider: 'lib/jquery.royalslider.min',
        },
        packages: [
            { name: 'core', location: 'core' }
        ],
        shim: {
            'jquery': {
                exports: '$'
            },
            'modernizr': {
                exports: 'Modernizr'
            }
        }
    });
});
