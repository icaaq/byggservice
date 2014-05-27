/*global
    Modernizr
*/
define([
    'jquery',
    'options',
    'pubsubBreakpoints',
    'pjax',
    'pubsub'
], function ($, options, pubsub, pjax) {
    'use strict';

    var defaults = {};

    var Troubleshooter = function (options) {
        this.opt = $.extend({}, defaults, options);
        return this;
    };

    Troubleshooter.prototype = {

        NAME: 'elux.troubleshooter',


        /*=========================================================================
         INIT
         =========================================================================*/

        init: function () {
            var self = this;
            self._calcLayoutHeightCurrent();

            if ($.support.pjax) {
                var $TroubleShooter = $('.troubleshooter-flow');
                var $loading = $TroubleShooter.find('loading');
                var $StepNext = $TroubleShooter.find('js-step-next');
                if ($loading.length === 0)  {
                    $TroubleShooter.find('.viewport').append('<div class="loading"></div>');
                }
                if ($StepNext.length === 0)  {
                    $TroubleShooter.find('.viewport').append('<div class="js-step-next"></div>');
                }
                $.pjax.defaults.scrollTo = false;
                self._bindEvents();

                pubsub.subscribe('troubleshooter-flow', function (e, state) {
                    switch(state) {
                    case 'calcLayoutHeightCurrent':
                        self._calcLayoutHeightCurrent();
                        break;
                    case 'calcLayoutHeightNext':
                        self._calcLayoutHeightNext();
                        break;
                    }
                });
            }
            return self;
        },

        _bindEvents: function () {
            self = this;
            var $tsContent = $('.troubleshooter-flow .content');

                // forward
                $tsContent.on('click', '.column a', function(event) {
                    var $tsStepNext = $tsContent.find('.js-step-next');
                    $tsStepNext.css('left', '100%');
                    $.pjax.click(event, {container: $tsStepNext});
                });

                // back and startover
                $tsContent.on('click', '.navigation a', function(event) {
                    var $tsStepNext = $tsContent.find('.js-step-next');
                    var $loading = $tsContent.find('.loading');
                    $tsStepNext.css('left', '-100%');
                    $loading.removeClass('show');
                    $.pjax.click(event, {container: $tsStepNext});
                });

                //pjax done with request
                $tsContent.on('pjax:end', function() {
                    var $tsStepNext = $tsContent.find('.js-step-next');
                    var $tsStepCurrent = $tsContent.find('.step-current');
                    var moveTo = 0;
                    pubsub.publish('troubleshooter-flow', 'calcLayoutHeightNext');
                    if (Number($tsStepNext.css('left').replace(/[^\d\.\-]/g, '')) > 0) {
                        moveTo = '-100%';
                    } else {
                        moveTo = '100%';
                    }

                    $tsStepCurrent.animate({left: moveTo}, 500);
                    $tsStepNext.animate({left: '0'}, 500, function() {
                        $tsStepNext.toggleClass('js-step-next step-current');
                        $tsStepCurrent.toggleClass('step-current js-step-next');
                    });
                });

            $tsContent.on('pjax:send', function() {
                var $loading = $tsContent.find('.loading');
                $loading.addClass('show');
            });

            $tsContent.on('pjax:success ', function() {
                var $loading = $tsContent.find('.loading');
                $loading.removeClass('show');
            });

            $tsContent.on('pjax:timeout', function(event) {
              // Prevent default timeout redirection behavior
              event.preventDefault();
            });

            $(window).resize(function() {
                pubsub.publish('troubleshooter-flow', 'calcLayoutHeightCurrent');
            });
        },

        _calcLayoutHeightCurrent: function () {
            var $tsViewport = $('.troubleshooter-flow .viewport');
            var $tsSteps = $('.step-current', $tsViewport);
            var tallestValue = 0;

                if ($tsSteps.outerHeight() > tallestValue) {
                    tallestValue = $tsSteps.outerHeight();
                }
            $tsViewport.css('height', (parseInt(tallestValue, 10)) );
        },

        _calcLayoutHeightNext: function () {
            var $tsViewport = $('.troubleshooter-flow .viewport');
            var $tsSteps = $('.js-step-next', $tsViewport);
            var tallestValue = 0;

                if ($tsSteps.outerHeight() > tallestValue) {
                    tallestValue = $tsSteps.outerHeight();
                }
            $tsViewport.css('height', (parseInt(tallestValue, 10)) );
        }
    };

    return Troubleshooter;

});
