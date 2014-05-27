//Adjust for going from portrait view to horisontal view without loosing the size of the window
// By @mathias, @cheeaun and @jdalton
define([], function () {
    'use strict';
    var doc = document,
        hasGesture = true;

    try {
        doc.createEvent('GestureEvent');
    } catch (err) {
        hasGesture = false;
    }

    var addEvent = 'addEventListener',
        type = 'gesturestart',
        qsa = 'querySelectorAll',
        scales = [1, 1],
        meta = qsa in doc ? doc[qsa]('meta[name=viewport]') : [];

    function fix() {
        meta.content = 'width=device-width,minimum-scale=' + scales[0] + ',maximum-scale=' + scales[1];
        doc.removeEventListener(type, fix, true);
    }

    if (hasGesture && (meta = meta[meta.length - 1]) && addEvent in doc) {
        fix();
        scales = [0.25, 1.6];
        doc[addEvent](type, fix, true);
    }

    return {};
});