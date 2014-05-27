/*global
    Modernizr
*/
define([
    'jquery',
    'options',
    'pjax',
    'pubsub'
], function ($, options, pjax) {
    'use strict';

    var defaults = {};

    var Pagination = function (options) {
        this.opt = $.extend({}, defaults, options);
        return this;
    };

    Pagination.prototype = {

        NAME: 'elux.pagination',


        /*=========================================================================
         INIT
         =========================================================================*/

        init: function () {
            var self = this;
            self._bindEvents();
            return self;
        },

        _bindEvents: function () {
            self = this;
            var $paginationWrapper = $('.pagination').parent();

            $paginationWrapper.on('click', '.pagination a', function(event) {
                event.preventDefault();
                var href = $(this).attr('href');
                var $pagination = $('.pagination');

                $pagination.addClass('loading');

                self._fetch(href).then(function (response) {
                    $pagination.fadeOut(400, function () {
                        $(this).remove();
                        $paginationWrapper.append(response);
                    });
                });
            });
        },

        _fetch: function (href) {
            return $.get(href);
        }
    };

    return Pagination;

});
