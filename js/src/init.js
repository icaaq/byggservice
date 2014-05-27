/**
 * Initiates the site scripts
 */
define([
    'jquery',
    'pubsub',
    'royalslider',
    'pubsubBreakpoints',
], function ($, pubsub) {
    'use strict';

        var windowHeight = $(window).height();
        var windowWidth = $(window).width();
        $('#full-width-slider').css({
            'height': windowHeight,
            'width': windowWidth
        });

        $('#full-width-slider').royalSlider({
            loop: true,
            keyboardNavEnabled: true,
            controlsInside: true,
            imageScaleMode: 'fill',
            arrowsNav: false,
            controlNavigation: 'bullets',
            thumbsFitInViewport: false,
            navigateByClick: false,
            startSlideId: 0,
            numImagesToPreload: 2,
            autoPlay: {
                // autoplay options go gere
                enabled: false,
                pauseOnHover: true,
                delay: 8000
            },
            height: windowHeight,
            width: windowWidth,
            transitionType: 'move',
            globalCaption: false,
            slidesSpacing: 0,
            randomizeSlides: false,
            fadeinLoadedSlide: true,
            addActiveClass: true
        });
        $('#full-width-slider').css({
            'width': '100%'
        });
});
