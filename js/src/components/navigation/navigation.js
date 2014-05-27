define([
    'jquery',
    'options',
    'pubsub',
    'breakpoints'
], function ($, options, pubsub, breakpoints) {
    'use strict';
    /*jshint unused: false */
    var defaults = {
        delta: 5,
        lastScrollTop: 0,
        didScroll: false,
        navbarHeight: 0,
    };


    var Navigation = function (options) {
        this.opt = $.extend({}, defaults, options, breakpoints);

        return this;
    };

    Navigation.prototype = {

        NAME: 'elux.nav',
      //  mode: MODE_DEFAULT,

       

        /*=========================================================================
         INIT
         =========================================================================*/

        init: function () {
            var self = this;
            defaults.navbarHeight = $('.site-header').outerHeight();
            self._bindEvents();

            var br = breakpoints.on({
                name: 'not-portable',
                matched: function() {
                    var didScroll;
                    $(window).scroll(function(){
                        didScroll = true;
                    });
                    setInterval(function() {
                        if (didScroll) {
                            pubsub.publish('site-header', 'scrolled');
                            didScroll = false;
                        }
                    }, 250);
                    var $navigation = $('.js-navigation');
                    if ($navigation.children('.nav-children').length === 0 ) {
                        var $navChildren = $navigation.find('.nav-children');
                        $navigation.append($navChildren);
                        self._calcLayout();
                    }
                },
                exit: function() {
                    pubsub.publish('site-header', 'show');
                    setInterval(function() {}, 250);
                    var $navigation = $('.js-navigation'),
                        $l1Item = $navigation.find('.l1-item.first-item'),
                        $navChildren = $navigation.find('.nav-children');
                    if ($l1Item.children('.nav-children') ) {
                        $l1Item.append($navChildren);
                    }
                }   
            });

            pubsub.subscribe('nav', function (e, state) {
                self.toggle(state);
            });
        },

        toggle: function (state) {
            var $navigation = $('.js-navigation'),
                $navChildren = $navigation.find('.nav-children'),
                $l1Items = $navigation.find('.l1-item'),
                $l2Items = $navigation.find('.l2-item');


            switch(state) {
                case 'hide':
                    var b1 = breakpoints.on({
                        name: 'not-portable',
                        matched: function() {
                            $navChildren.removeClass('is-expanded');
                        }
                    });
                    
                    $l1Items.removeClass('is-expanded');
                    $l2Items.removeClass('is-expanded');
                    $navigation.removeClass('is-expanded');
                    break;
                case 'show':
                    var b2 = breakpoints.on({
                        name: 'not-portable',
                         matched: function() {
                           $navChildren.addClass('is-expanded');
                        }
                    });
                  
                    pubsub.publish('nav-search', 'hide');
                    $navigation.addClass('is-expanded');
                    break;
            }
        },

        _calcLayout: function () {
            /*jshint unused: false */
            var $navigation = $('.js-navigation'),
                $navChildren = $navigation.find('.nav-children'),
                $l3Parents = $navigation.find('.l3-parent'),
                $l2Nav = $navigation.find('.l2-nav'),
                $campItems = $navigation.find('.campaign-item'),
                tallestValue = 0;

            $.each($l3Parents, function(k, v) {
                if ($(this).outerHeight() > tallestValue) {
                    tallestValue = $(this).outerHeight();
                }
            });
            $.each($campItems, function(k, v) {
                if ($(this).outerHeight() > tallestValue) {
                    tallestValue = $(this).outerHeight();
                }
            });
            $l2Nav.css('height', (parseInt(tallestValue+60, 10)) );
        },




        _bindEvents: function () {

            var $navigation = $('.js-navigation'),
                $l1Items = $navigation.find('.l1-item.has-children'),
                $l2Items = $navigation.find('.l2-item.has-children'),
                $l3Items = $navigation.find('.l3-item'),
                $campaign = $navigation.find('.campaign'),
                self = this;

                // Show and hide meny on mobile
            $navigation.find('.small-navigation').on('click',  function(e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if ($navigation.hasClass('is-expanded')) {
                    pubsub.publish('overlay', 'hide');
                    pubsub.publish('nav', 'hide');
                } else {
                    pubsub.publish('overlay', 'show');
                    pubsub.publish('nav', 'show');
                }
            });

             $(window).resize(function() {
                self._calcLayout();
             });


            $.each($l3Items, function(k, v) {
                var $value = $(v);
                $value.find('a').on('click',  function(e) {
                    e.stopImmediatePropagation();
                });
            });

                // Open level 2
            $.each($l2Items, function(k, v) {
                var $value = $(v);
                $value.find('a').on('click',  function(e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if ($value.hasClass('is-expanded')) {
                       $value.removeClass('is-expanded');
                       $campaign.removeClass('is-hidden');
                    } else {
                        $l2Items.removeClass('is-expanded');
                        $value.addClass('is-expanded');
                        $campaign.addClass('is-hidden');
                    }
                });
            });

                  // Open level 1
            $.each($l1Items, function(k, v) {
                var $value = $(v);
                $value.find('a').on('click', function(e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if ( $value.hasClass('is-expanded')) {
                         var b1 = breakpoints.on({
                            name: 'not-portable',
                            matched: function() {
                                pubsub.publish('nav', 'hide');
                                pubsub.publish('overlay', 'hide');
                            }
                        });

                        $value.removeClass('is-expanded');
                        $l2Items.removeClass('is-expanded');
                    } else {
                        pubsub.publish('nav', 'show');
                        pubsub.publish('overlay', 'show');
                        $l1Items.removeClass('is-expanded');
                        $campaign.removeClass('is-hidden');
                        $value.addClass('is-expanded');
                        var b2 = breakpoints.on({
                            name: 'not-portable',
                            matched: function() {
                                self._calcLayout();
                            }
                        });
                      
                    }
                });
            });

            /*jshint unused:false */
            pubsub.subscribe('site-header', function (e, state) {
                var $siteheader = $('.site-header');
                switch(state) {
                    case 'show':
                        $siteheader.removeClass('hide');
                        break;
                    case 'scrolled':
                        var st = $(window).scrollTop();
                        // Make sure they scroll more than delta
                        if(Math.abs(defaults.lastScrollTop - st) <= defaults.delta) {
                            return;
                        }
                        // If they scrolled down and are past the navbar, add class .nav-up.
                        // This is necessary so you never see what is "behind" the navbar.
                        if (st > defaults.lastScrollTop && st > defaults.navbarHeight){
                            // Scroll Down
                            $siteheader.addClass('hide');
                        } else {
                            // Scroll Up
                            if(st + $(window).height() < $(document).height()) {
                               $siteheader.removeClass('hide');
                            }
                        }
                        defaults.lastScrollTop = st;
                        break;
                }
               
            });
        }
    };
    return Navigation;
});
