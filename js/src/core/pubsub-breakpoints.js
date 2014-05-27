define([
    'breakpoints',
    'pubsub'
], function (Breakpoints, pubsub) {
    'use strict';
    /*jshint unused: false */
    /**
     * Initiate js breakpoints
     */
    var initBreakpoints = function () {
        Breakpoints.on({
            name: 'palm',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

        Breakpoints.on({
            name: 'big-palm',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

        Breakpoints.on({
            name: 'lap',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

        Breakpoints.on({
            name: 'desk',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

        Breakpoints.on({
            name: 'desk-wide',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

         Breakpoints.on({
            name: 'portable',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

          Breakpoints.on({
            name: 'not-portable',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });
    };

    // Activate on init
    pubsub.subscribe('init', initBreakpoints);

    return pubsub;
});
