define([
    'jquery',
    'options',
    'pubsubBreakpoints',
    'pubsub'
], function ($, options, pubsub) {
    'use strict';

    var defaults = {
    };


    var Overlay = function (options) {
        this.opt = $.extend({}, defaults, options);

        return this;
    };

    Overlay.prototype = {

        NAME: 'elux.overlay',
      //  mode: MODE_DEFAULT,

       

        /*=========================================================================
         INIT
         =========================================================================*/

        init: function () {
            var self = this;
            pubsub.subscribe('overlay', function (e, state) {
                self.toggle(state);
            });
        },

        toggle: function(state) {
            var $inElement = $('main'),
                $overlay = $inElement.find('.overlay');

            if ($overlay.length === 0)  {
                $overlay = $('<div class="overlay" />');
                $inElement.append($overlay);
                setTimeout(function(){$overlay.addClass('is-active');}, 50); // let DOM recognice new element to transitions to take affect.
                $overlay.on('click', function(){
                    pubsub.publish('nav', 'hide');
                    pubsub.publish('overlay', 'hide');
                    pubsub.publish('nav-search', 'hide');
                });

                return;
            }
            switch (state) {
                case 'show': 
                    $overlay.addClass('is-active');
                    break;
                case 'hide':
                    $overlay.removeClass('is-active');
                    break;
            }
        },
    };
    return Overlay;
});
