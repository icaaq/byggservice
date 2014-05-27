/**
 * elux.options
 */
define([
    'jquery',
    'window',
    'modernizr'
], function ($, win, Modernizr) {
    'use strict';

    var options = win.ELUX_OPTIONS;

    var defaults = {
    };

    defaults.browser = {
        oldIE: $('html').hasClass('lt-ie9'),
        isModern: Modernizr.mq('only all') && Modernizr.csstransforms && Modernizr.generatedcontent
    };

    return $.extend({}, defaults, options);
});
