/* jshint undef: true, boss: true */
define(['window'], function (global) {
    'use strict';
    /**
     * make it safe to use console.log always
     */
    (function (b) {
        var a, c, d, _results;
        c = function () {
        };
        d = 'assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,timeStamp,profile,profileEnd,time,timeEnd,trace,warn'.split(',');
        a = void 0;
        _results = [];
        while (a = d.pop()) {
            _results.push(b[a] = b[a] || c);
        }
        return _results;
    })((function () {
            try {
                console.log();
                return global.console;
            } catch (err) {
                return global.console = {};
            }
        })());

    /**
     * usage: log('inside coolFunc',this,arguments);
     * paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
     */
    global.log = function () {
        global.log.history = global.log.history || [];
        global.log.history.push(arguments);
        if (global.console) {
            return console.log(Array.prototype.slice.call(arguments));
        }
    };
});
