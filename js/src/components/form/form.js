define([
    'jquery',
    'options',
    'plugins'
], function ($, options) {
    'use strict';

    var defaults = {
    };


    var Form = function (options) {
        this.opt = $.extend({}, defaults, options);

        return this;
    };

    Form.prototype = {

        NAME: 'elux.form',
      //  mode: MODE_DEFAULT,



        /*=========================================================================
         INIT
         =========================================================================*/

        init: function () {
            var self = this;
            self._bindEvents();
            $('form').h5Validate();
        },

        _bindEvents: function () {
            var $selects = $('select');

            $selects.on('focusin focusout', function(e) {
                if (e.type === 'focusin') {
                    $(this).next('span').addClass('active');
                } else {
                    $(this).next('span').removeClass('active');
                }
            });

            $selects.on('change keydown', function(e) {
                $(this).next('span').text($(this).find(":selected").text());
            });

            $('body').on('keydown mousedown', function(e) {
                var $html = $('html');
                if (!$html.hasClass('keyboard') && e.type === 'keydown' && !$(e.target).is(':input')) {
                    $html.addClass('keyboard');
                }
                if ($html.hasClass('keyboard') && e.type === 'mousedown') {
                    $html.removeClass('keyboard');
                }
            });

            $('.toggle-button').on('click', function(e) {
                e.preventDefault();
                var $button = $(this);
                var pressed = $button.attr('aria-pressed') == "true";
                $button.attr('aria-pressed', pressed ? "false" : "true");
                $button.trigger('toggle-active', [!pressed]);
            });
        }
    };
    return Form;
});
