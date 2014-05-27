// http://www.nczonline.net/blog/2013/01/15/fixing-skip-to-content-links/
/*jshint unused: false */
define([], function () {
    'use strict';
    var onHashChange = function(event) {

        var element = document.getElementById(location.hash.substring(1));

        if (element) {

            if (!/^(?:a|select|input|button|textarea)$/i.test(element.tagName)) {
                element.tabIndex = -1;
            }

            element.focus();
        }

    };

    if(window.addEventListener) {
        window.addEventListener('hashchange', onHashChange, false);
    } else {
        window.attachEvent('onhashchange', onHashChange, false);
    }

    return {};
});

