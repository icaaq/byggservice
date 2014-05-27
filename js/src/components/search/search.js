/*global
    Modernizr
*/
define([
    'jquery',
    'options',
    'pubsubBreakpoints',
    'pubsub'
], function ($, options, pubsub) {
    'use strict';

    var defaults = {};

    var Search = function (options) {
        this.opt = $.extend({}, defaults, options);
        return this;
    };

    Search.prototype = {

        NAME: 'elux.search',


        /*=========================================================================
         INIT
         =========================================================================*/

        init: function () {
            var self = this;

            self._addAttr();
            self._bindEvents();
            self._bindManualSearchEvents();

            pubsub.subscribe('nav-search', function (e, state) {
                self.toggleNavSearch(state);
            });

            pubsub.subscribe('categoryListUpdate', function (e, href) {
                self.categoryListUpdate(href);
            });


            return self;
        },

        _addAttr: function() {
            var $searchButton =  $('.toolbar .search');
            $searchButton.parent().attr('role', 'search');
            $searchButton.attr({
                'role': 'button',
                'aria-haspopup': true,
                'aria-controls': 'search'
            }).data('active', false);
        },

        categoryListUpdate: function (href) {
            var $categoryList = $('.category-list');

            $categoryList.find('.selected').removeClass('selected');
            $categoryList.find('a[href="'+href+'"]').addClass('selected');
            $.pjax({url: href, container: '#search-result'});
        },

        _bindEvents: function () {
            var $searchButton =  $('.toolbar .search');
            var $resetButton = $('.search-field button[type=reset]');
            var $palmSelect = $('.palm select');
            $searchButton.on('click', function(e) {
                e.preventDefault();
                var $self = $(this);
                var active = $self.data('active');

                if (active) {
               //     $self.data('active', false);
                    pubsub.publish('overlay', 'hide');
                    pubsub.publish('nav-search', 'hide');
                } else {
                //    $self.data('active', true);
                    pubsub.publish('nav', 'hide');
                    pubsub.publish('overlay', 'show');
                    pubsub.publish('nav-search', 'show');
                }
            });

            $resetButton.on('click', function(e) {
                e.preventDefault();
                $('.search-field input').val('').focus();
            });

            if ($.support.pjax) {
                $('.category-list').on('click', 'a', function(e) {
                    e.preventDefault();
                    pubsub.publish('categoryListUpdate', $(this).attr('href'));
                });
            }

            $palmSelect.on('change', function(e) {
                e.preventDefault();
                var href = $(this).val();
                if ($.support.pjax) {
                    pubsub.publish('categoryListUpdate', href);
                } else {
                    document.location.href = href;
                }
            });

        },

        _bindManualSearchEvents: function () {
            $('.manual-search-result-item').on('toggle-active', '.toggle-button', function(e, active) {
                e.preventDefault();
                var otherLanguagesHolder = $(this).parent().next('.other-languages-holder');
                if (active) {
                    otherLanguagesHolder.addClass("show");
                } else {
                    otherLanguagesHolder.removeClass("show");
                }
            });
        },

        toggleNavSearch: function (state) {
            var $navSearch = $('.nav-search');
            var $search = $('#search');
            var $searchButton =  $('.toolbar .search');
            var transEndEventName = Modernizr.prefixed('transition')+'end';

            if (state === 'show') {
                $navSearch.addClass('show');
                $searchButton.addClass('is-active');
                $searchButton.data('active', true);

                /*
                    if csstransitions is supported show the input field
                    after the animation is done else show immediately
                */
                if (Modernizr.csstransitions) {
                    $navSearch.on(transEndEventName, function(e) {
                        e.preventDefault();
                        $search.addClass('show');
                        $('#nav-search').focus();
                    });
                } else {
                    $search.addClass('show');
                }
            } else {
                $navSearch.off(transEndEventName);
                $search.removeClass('show');
                $searchButton.focus();
                $searchButton.data('active', false);
                $searchButton.removeClass('is-active');
                $navSearch.removeClass('show');
            }
        }
    };

    return Search;

});
