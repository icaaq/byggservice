(function () {/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../lib/require/almond", function(){});

/*global define, require */
define('jquery',[], function(){
    
    return jQuery;
});
define('window',[], function () {
    
    return window;
});
/*global define, require */
define('modernizr',[], function(){
    
    return Modernizr;
});
/**
 * elux.options
 */
define('options',[
    'jquery',
    'window',
    'modernizr'
], function ($, win, Modernizr) {
    

    var options = win.ELUX_OPTIONS;

    var defaults = {
    };

    defaults.browser = {
        oldIE: $('html').hasClass('lt-ie9'),
        isModern: Modernizr.mq('only all') && Modernizr.csstransforms && Modernizr.generatedcontent
    };

    return $.extend({}, defaults, options);
});

/*
Copyright (c) 2010,2011,2012,2013 Morgan Roderick http://roderick.dk
License: MIT - http://mrgnrdrck.mit-license.org

https://github.com/mroderick/PubSubJS
*/
/*jslint white:true, plusplus:true, stupid:true*/
/*global
	setTimeout,
	module,
	exports,
	define,
	require,
	window
*/
(function (root, factory) {
    

    // CommonJS
    if (typeof exports === 'object' && module) {
        module.exports = factory();

        // AMD
    } else if (typeof define === 'function' && define.amd) {
        define('pubsub',factory);
        // Browser
    } else {
        root.PubSub = factory();
    }
}(( typeof window === 'object' && window ) || this, function () {

    

    var PubSub = {},
        messages = {},
        lastUid = -1;

    /**
     *    Returns a function that throws the passed exception, for use as argument for setTimeout
     *    @param { Object } ex An Error object
     */
    function throwException(ex) {
        return function reThrowException() {
            throw ex;
        };
    }

    function callSubscriberWithDelayedExceptions(subscriber, message, data) {
        try {
            subscriber(message, data);
        } catch (ex) {
            setTimeout(throwException(ex), 0);
        }
    }

    function callSubscriberWithImmediateExceptions(subscriber, message, data) {
        subscriber(message, data);
    }

    function deliverMessage(originalMessage, matchedMessage, data, immediateExceptions) {
        var subscribers = messages[matchedMessage],
            callSubscriber = immediateExceptions ? callSubscriberWithImmediateExceptions : callSubscriberWithDelayedExceptions,
            i, j;

        if (!messages.hasOwnProperty(matchedMessage)) {
            return;
        }

        // do not cache the length of the subscribers array, as it might change if there are unsubscribtions
        // by subscribers during delivery of a topic
        // see https://github.com/mroderick/PubSubJS/issues/26
        for (i = 0; i < subscribers.length; i++) {
            callSubscriber(subscribers[i].func, originalMessage, data);
        }
    }

    function createDeliveryFunction(message, data, immediateExceptions) {
        return function deliverNamespaced() {
            var topic = String(message),
                position = topic.lastIndexOf('.');

            // deliver the message as it is now
            deliverMessage(message, message, data, immediateExceptions);

            // trim the hierarchy and deliver message to each level
            while (position !== -1) {
                topic = topic.substr(0, position);
                position = topic.lastIndexOf('.');
                deliverMessage(message, topic, data);
            }
        };
    }

    function messageHasSubscribers(message) {
        var topic = String(message),
            found = messages.hasOwnProperty(topic),
            position = topic.lastIndexOf('.');

        while (!found && position !== -1) {
            topic = topic.substr(0, position);
            position = topic.lastIndexOf('.');
            found = messages.hasOwnProperty(topic);
        }

        return found && messages[topic].length > 0;
    }

    function publish(message, data, sync, immediateExceptions) {
        var deliver = createDeliveryFunction(message, data, immediateExceptions),
            hasSubscribers = messageHasSubscribers(message);

        if (!hasSubscribers) {
            return false;
        }

        if (sync === true) {
            deliver();
        } else {
            setTimeout(deliver, 0);
        }
        return true;
    }

    /**
     *    PubSub.publish( message[, data] ) -> Boolean
     *    - message (String): The message to publish
     *    - data: The data to pass to subscribers
     *    Publishes the the message, passing the data to it's subscribers
     **/
    PubSub.publish = function (message, data) {
        return publish(message, data, false, PubSub.immediateExceptions);
    };

    /**
     *    PubSub.publishSync( message[, data] ) -> Boolean
     *    - message (String): The message to publish
     *    - data: The data to pass to subscribers
     *    Publishes the the message synchronously, passing the data to it's subscribers
     **/
    PubSub.publishSync = function (message, data) {
        return publish(message, data, true, PubSub.immediateExceptions);
    };

    /**
     *    PubSub.subscribe( message, func ) -> String
     *    - message (String): The message to subscribe to
     *    - func (Function): The function to call when a new message is published
     *    Subscribes the passed function to the passed message. Every returned token is unique and should be stored if
     *    you need to unsubscribe
     **/
    PubSub.subscribe = function (message, func) {
        if (typeof func !== 'function') {
            return false;
        }

        // message is not registered yet
        if (!messages.hasOwnProperty(message)) {
            messages[message] = [];
        }

        // forcing token as String, to allow for future expansions without breaking usage
        // and allow for easy use as key names for the 'messages' object
        var token = String(++lastUid);
        messages[message].push({ token: token, func: func });

        // return token for unsubscribing
        return token;
    };

    /**
     *    PubSub.unsubscribe( tokenOrFunction ) -> String | Boolean
     *  - tokenOrFunction (String|Function): The token of the function to unsubscribe or func passed in on subscribe
     *  Unsubscribes a specific subscriber from a specific message using the unique token
     *  or if using Function as argument, it will remove all subscriptions with that function
     **/
    PubSub.unsubscribe = function (tokenOrFunction) {
        var isToken = typeof tokenOrFunction === 'string',
            key = isToken ? 'token' : 'func',
            succesfulReturnValue = isToken ? tokenOrFunction : true,

            result = false,
            m, i;

        for (m in messages) {
            if (messages.hasOwnProperty(m)) {
                for (i = messages[m].length - 1; i >= 0; i--) {
                    if (messages[m][i][key] === tokenOrFunction) {
                        messages[m].splice(i, 1);
                        result = succesfulReturnValue;

                        // tokens are unique, so we can just return here
                        if (isToken) {
                            return result;
                        }
                    }
                }
            }
        }

        return result;
    };

    return PubSub;
}));
define('document',[], function () {
    
    return document;
});
/*global window:true */
define('breakpoints',[
    'window',
    'document'
], function (window, document) {
    

    var B = {},
        resizingTimeout = 200,
        breakpoints = [],
        hasFullComputedStyleSupport = false,

        TEST_FULL_GETCOMPUTEDSTYLE_SUPPORT = 'js-breakpoints-getComputedStyleTest',
        TEST_FALLBACK_PROPERTY = 'position',
        TEST_FALLBACK_VALUE = 'absolute',

    // thanks John Resig
        addEvent = function (obj, type, fn) {
            if (obj.attachEvent) {
                obj['e' + type + fn] = fn;
                obj[type + fn] = function () {
                    obj['e' + type + fn](window.event);
                };
                obj.attachEvent('on' + type, obj[type + fn]);
            } else {
                obj.addEventListener(type, fn, false);
            }
        },

        debounce = function (func, wait, immediate) {
            var timeout, result;
            return function () {

                var context = this, args = arguments;
                var later = function () {
                    timeout = null;
                    if (!immediate) {result = func.apply(context, args);}
                };

                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) result = func.apply(context, args);
                return result;
            };
        },

        injectElementWithClassName = function (parent, className, callback) {
            var div = document.createElement('div');
            div.className = 'js-breakpoints-' + className;
            parent.appendChild(div);
            callback(div);
            div.parentNode.removeChild(div);
        },

        check = function (breakpoint) {
            var match = B.isMatched(breakpoint);

            if (match && !breakpoint.isMatched) {
                breakpoint.matched.call(breakpoint.context);
                breakpoint.isMatched = true;
            } else if (!match && breakpoint.isMatched) {
                breakpoint.exit.call(breakpoint.context);
                breakpoint.isMatched = false;
            }
            return breakpoint;
        },

        onWindowResize = function () {
            for (var i = 0; i < breakpoints.length; i++) {
                check(breakpoints[i]);
            }
        },

        getStyle = function (el, pseudo, property) {
            if (window.getComputedStyle) {
                return window.getComputedStyle(el, pseudo).getPropertyValue(property);
            }
            else if (el.currentStyle && pseudo.length === 0) {
                return el.currentStyle[property];
            }
            return '';
        },

        checkComputedStyleSupport = function () {
            if (window.getComputedStyle) {
                var content = window.getComputedStyle(document.documentElement, ':after').getPropertyValue('content');
                hasFullComputedStyleSupport = content === TEST_FULL_GETCOMPUTEDSTYLE_SUPPORT;
            }
        },

        init = function () {
            checkComputedStyleSupport();
            var debounceResize = debounce(onWindowResize, resizingTimeout);
            addEvent(window, 'resize', debounceResize);
            addEvent(window, 'orientationchange', debounceResize);
            return B;
        };

    B.isMatched = function (breakpoint) {
        var el = breakpoint.el || document.body,
            matched = false,
            value;

        if (hasFullComputedStyleSupport) {
            value = getStyle(el, ':after', 'content');
            matched = value.replace(/"/g, '') === breakpoint.name;
        }
        else {
            injectElementWithClassName(el, breakpoint.name, function (el) {
                value = getStyle(el, '', TEST_FALLBACK_PROPERTY);
                matched = value === TEST_FALLBACK_VALUE;
            });
        }

        return matched;
    };

    B.on = function (breakpoint) {
        breakpoints.push(breakpoint);
        breakpoint.isMatched = false;
        breakpoint.matched = breakpoint.matched || function () {
        };
        breakpoint.exit = breakpoint.exit || function () {
        };
        breakpoint.context = breakpoint.context || breakpoint;
        return check(breakpoint);
    };

    B.off = function (breakpoint) {
        var i = breakpoints.indexOf(breakpoint);
        if (i > -1) {
            breakpoints.splice(i, 1);
        }
    };

    return init();
});





define('navigation/navigation',[
    'jquery',
    'options',
    'pubsub',
    'breakpoints'
], function ($, options, pubsub, breakpoints) {
    
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

/*jshint unused: false */
define('navigation/main',[
    'jquery',
    './navigation',
], function ( $, Navigation, options) {
    
    

    return new Navigation();
});
define('navigation', ['navigation/main'], function (main) { return main; });

define('pubsubBreakpoints',[
    'breakpoints',
    'pubsub'
], function (Breakpoints, pubsub) {
    
    /*jshint unused: false */
    /**
     * Initiate js breakpoints
     */
    var initBreakpoints = function () {
        Breakpoints.on({
            name: 'palm',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

        Breakpoints.on({
            name: 'big-palm',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

        Breakpoints.on({
            name: 'lap',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

        Breakpoints.on({
            name: 'desk',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

        Breakpoints.on({
            name: 'desk-wide',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

         Breakpoints.on({
            name: 'portable',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });

          Breakpoints.on({
            name: 'not-portable',
            matched: function (e) {
                pubsub.publish('mqenter', this.name);
            },
            exit: function (e) {
                pubsub.publish('mqexit', this.name);
            }
        });
    };

    // Activate on init
    pubsub.subscribe('init', initBreakpoints);

    return pubsub;
});

/*global
    Modernizr
*/
define('search/search',[
    'jquery',
    'options',
    'pubsubBreakpoints',
    'pubsub'
], function ($, options, pubsub) {
    

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

/*jshint unused: false */
define('search/main',[
    'jquery',
    './search',
], function ( $, Search, options) {
    


    return new Search();
});

define('search', ['search/main'], function (main) { return main; });

define('overlay/overlay',[
    'jquery',
    'options',
    'pubsubBreakpoints',
    'pubsub'
], function ($, options, pubsub) {
    

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

define('overlay/main',[
    'jquery',
    './overlay',
], function ( $, Overlay, options) {
    

    options = options;
    return new Overlay();
});
define('overlay', ['overlay/main'], function (main) { return main; });

/**
 * h5Validate
 * @version v0.9.0
 * Using semantic versioning: http://semver.org/
 * @author Eric Hamilton http://ericleads.com/
 * @copyright 2010 - 2012 Eric Hamilton
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * Developed under the sponsorship of RootMusic, Zumba Fitness, LLC, and Rese Property Management
 */

/*global jQuery, window, console */
define('plugins/jquery-h5validate',[
    'jquery'
], function ($) {
    
        var console = window.console || function () {},
        h5 = { // Public API
            defaults : {
                debug: false,

                RODom: false,

                // HTML5-compatible validation pattern library that can be extended and/or overriden.
                patternLibrary : { //** TODO: Test the new regex patterns. Should I apply these to the new input types?
                    // **TODO: password
                    phone: /([\+][0-9]{1,3}([ \.\-])?)?([\(][0-9]{1,6}[\)])?([0-9A-Za-z \.\-]{1,32})(([A-Za-z \:]{1,11})?[0-9]{1,4}?)/,

                    // Shamelessly lifted from Scott Gonzalez via the Bassistance Validation plugin http://projects.scottsplayground.com/email_address_validation/
                    email: /((([a-zA-Z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-zA-Z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?/,

                    // Shamelessly lifted from Scott Gonzalez via the Bassistance Validation plugin http://projects.scottsplayground.com/iri/
                    url: /(https?|ftp):\/\/(((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?/,

                    // Number, including positive, negative, and floating decimal. Credit: bassistance
                    number: /-?(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d+)?/,

                    // Date in ISO format. Credit: bassistance
                    dateISO: /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,

                    alpha: /[a-zA-Z]+/,
                    alphaNumeric: /\w+/,
                    integer: /-?\d+/
                },

                // The prefix to use for dynamically-created class names.
                classPrefix: 'h5-',

                errorClass: 'ui-state-error', // No prefix for these.
                validClass: 'ui-state-valid', // "
                activeClass: 'active', // Prefix will get prepended.
                requiredClass: 'required',
                requiredAttribute: 'required',
                patternAttribute: 'pattern',

                // Attribute which stores the ID of the error container element (without the hash).
                errorAttribute: 'data-h5-errorid',

                // Events API
                customEvents: {
                    'validate': true
                },

                // Setup KB event delegation.
                kbSelectors: ':input:not(:button):not(:disabled):not(.novalidate)',
                focusout: true,
                focusin: false,
                change: true,
                keyup: false,
                activeKeyup: true,

                // Setup mouse event delegation.
                mSelectors: '[type="range"]:not(:disabled):not(.novalidate), :radio:not(:disabled):not(.novalidate), :checkbox:not(:disabled):not(.novalidate), select:not(:disabled):not(.novalidate), option:not(:disabled):not(.novalidate)',
                click: true,

                // What do we name the required .data variable?
                requiredVar: 'h5-required',

                // What do we name the pattern .data variable?
                patternVar: 'h5-pattern',
                stripMarkup: true,

                // Run submit related checks and prevent form submission if any fields are invalid?
                submit: true,

                // Move focus to the first invalid field on submit?
                focusFirstInvalidElementOnSubmit: true,

                // When submitting, validate elements that haven't been validated yet?
                validateOnSubmit: true,

                // Callback stubs
                invalidCallback: function () {},
                validCallback: function () {},

                // Elements to validate with allValid (only validating visible elements)
                allValidSelectors: ':input:visible:not(:button):not(:disabled):not(.novalidate)',

                // Mark field invalid.
                // ** TODO: Highlight labels
                // ** TODO: Implement setCustomValidity as per the spec:
                // http://www.whatwg.org/specs/web-apps/current-work/multipage/association-of-controls-and-forms.html#dom-cva-setcustomvalidity
                markInvalid: function markInvalid(options) {
                    var $element = $(options.element),
                        $errorID = $(options.errorID);
                    $element.addClass(options.errorClass).removeClass(options.validClass);

                    // User needs help. Enable active validation.
                    $element.addClass(options.settings.activeClass);

                    if ($errorID.length) { // These ifs are technically not needed, but improve server-side performance
                        if ($element.attr('title')) {
                            $errorID.text($element.attr('title'));
                        }
                        $errorID.show();
                    }
                    $element.data('valid', false);
                    options.settings.invalidCallback.call(options.element, options.validity);
                    return $element;
                },

                // Mark field valid.
                markValid: function markValid(options) {
                    var $element = $(options.element),
                        $errorID = $(options.errorID);

                    $element.addClass(options.validClass).removeClass(options.errorClass);
                    if ($errorID.length) {
                        $errorID.hide();
                    }
                    $element.data('valid', true);
                    options.settings.validCallback.call(options.element, options.validity);
                    return $element;
                },

                // Unmark field
                unmark: function unmark(options) {
                    var $element = $(options.element);
                    $element.removeClass(options.errorClass).removeClass(options.validClass);
                    $element.form.find("#" + options.element.id).removeClass(options.errorClass).removeClass(options.validClass);
                    return $element;
                }
            }
        },

        // Aliases
        defaults = h5.defaults,
        patternLibrary = defaults.patternLibrary,

        createValidity = function createValidity(validity) {
            return $.extend({
                customError: validity.customError || false,
                patternMismatch: validity.patternMismatch || false,
                rangeOverflow: validity.rangeOverflow || false,
                rangeUnderflow: validity.rangeUnderflow || false,
                stepMismatch: validity.stepMismatch || false,
                tooLong: validity.tooLong || false,
                typeMismatch: validity.typeMismatch || false,
                valid: validity.valid || true,
                valueMissing: validity.valueMissing || false
            }, validity);
        },

        methods = {
            /**
             * Check the validity of the current field
             * @param  {object}  settings   instance settings
             * @param  {object}  options
             *          .revalidate - trigger validation function first?
             * @return {Boolean}
             */
            isValid: function (settings, options) {
                var $this = $(this);

                options = (settings && options) || {};

                // Revalidate defaults to true
                if (options.revalidate !== false) {
                    $this.trigger('validate');
                }

                return $this.data('valid'); // get the validation result
            },
            allValid: function (config, options) {
                var valid = true,
                    formValidity = [],
                    $this = $(this),
                    $allFields,
                    $filteredFields,
                    radioNames = [],
                    getValidity = function getValidity(e, data) {
                        data.e = e;
                        formValidity.push(data);
                    },
                    settings = $.extend({}, config, options); // allow options to override settings

                options = options || {};

                $this.trigger('formValidate', {settings: $.extend(true, {}, settings)});

                // Make sure we're not triggering handlers more than we need to.
                $this.undelegate(settings.allValidSelectors,
                    '.allValid', getValidity);
                $this.delegate(settings.allValidSelectors,
                    'validated.allValid', getValidity);

                $allFields = $this.find(settings.allValidSelectors);

                // Filter radio buttons with the same name and keep only one,
                // since they will be checked as a group by isValid()
                $filteredFields = $allFields.filter(function(index) {
                    var name;

                    if(this.tagName === "INPUT"
                        && this.type === "radio") {
                        name = this.name;
                        if(radioNames[name] === true) {
                            return false;
                        }
                        radioNames[name] = true;
                    }
                    return true;
                });

                $filteredFields.each(function () {
                    var $this = $(this);
                    valid = $this.h5Validate('isValid', options) && valid;
                });

                $this.trigger('formValidated', {valid: valid, elements: formValidity});
                return valid;
            },
            validate: function (settings) {
                // Get the HTML5 pattern attribute if it exists.
                // ** TODO: If a pattern class exists, grab the pattern from the patternLibrary, but the pattern attrib should override that value.
                var $this = $(this),
                    pattern = $this.filter('[pattern]')[0] ? $this.attr('pattern') : false,

                    // The pattern attribute must match the whole value, not just a subset:
                    // "...as if it implied a ^(?: at the start of the pattern and a )$ at the end."
                    re = new RegExp('^(?:' + pattern + ')$'),
                    $radiosWithSameName = null,
                    value = ($this.is('[type=checkbox]')) ?
                            $this.is(':checked') : ($this.is('[type=radio]') ?
                                // Cache all radio buttons (in the same form) with the same name as this one
                                ($radiosWithSameName = $this.parents('form')
                                    // **TODO: escape the radio buttons' name before using it in the jQuery selector
                                    .find('input[name="' + $this.attr('name') + '"]'))
                                    .filter(':checked')
                                    .length > 0 : $this.val()),
                    errorClass = settings.errorClass,
                    validClass = settings.validClass,
                    errorIDbare = $this.attr(settings.errorAttribute) || false, // Get the ID of the error element.
                    errorID = errorIDbare ? '#' + errorIDbare.replace(/(:|\.|\[|\])/g,'\\$1') : false, // Add the hash for convenience. This is done in two steps to avoid two attribute lookups.
                    required = false,
                    validity = createValidity({element: this, valid: true}),
                    $checkRequired = $('<input required>'),
                    maxlength;

                /*  If the required attribute exists, set it required to true, unless it's set 'false'.
                *   This is a minor deviation from the spec, but it seems some browsers have falsey
                *   required values if the attribute is empty (should be true). The more conformant
                *   version of this failed sanity checking in the browser environment.
                *   This plugin is meant to be practical, not ideologically married to the spec.
                */
                // Feature fork
                if ($checkRequired.filter('[required]') && $checkRequired.filter('[required]').length) {
                    required = ($this.filter('[required]').length && $this.attr('required') !== 'false');
                } else {
                    required = ($this.attr('required') !== undefined);
                }

                if (settings.debug && window.console) {
                    console.log('Validate called on "' + value + '" with regex "' + re + '". Required: ' + required); // **DEBUG
                    console.log('Regex test: ' + re.test(value) + ', Pattern: ' + pattern); // **DEBUG
                }

                maxlength = parseInt($this.attr('maxlength'), 10);
                if (!isNaN(maxlength) && value.length > maxlength) {
                        validity.valid = false;
                        validity.tooLong = true;
                }

                if (required && !value) {
                    validity.valid = false;
                    validity.valueMissing = true;
                } else if (pattern && !re.test(value) && value) {
                    validity.valid = false;
                    validity.patternMismatch = true;
                } else {
                    if (!settings.RODom) {
                        settings.markValid({
                            element: this,
                            validity: validity,
                            errorClass: errorClass,
                            validClass: validClass,
                            errorID: errorID,
                            settings: settings
                        });
                    }
                }

                if (!validity.valid) {
                    if (!settings.RODom) {
                        settings.markInvalid({
                            element: this,
                            validity: validity,
                            errorClass: errorClass,
                            validClass: validClass,
                            errorID: errorID,
                            settings: settings
                        });
                    }
                }
                $this.trigger('validated', validity);

                // If it's a radio button, also validate the other radio buttons with the same name
                // (while making sure the call is not recursive)
                if($radiosWithSameName !== null
                    && settings.alreadyCheckingRelatedRadioButtons !== true) {

                    settings.alreadyCheckingRelatedRadioButtons = true;

                    $radiosWithSameName
                        .not($this)
                        .trigger('validate');

                    settings.alreadyCheckingRelatedRadioButtons = false;

                }
            },

            /**
             * Take the event preferences and delegate the events to selected
             * objects.
             *
             * @param {object} eventFlags The object containing event flags.
             *
             * @returns {element} The passed element (for method chaining).
             */
            delegateEvents: function (selectors, eventFlags, element, settings) {
                var events = {},
                    key = 0,
                    validate = function () {
                        settings.validate.call(this, settings);
                    };
                $.each(eventFlags, function (key, value) {
                    if (value) {
                        events[key] = key;
                    }
                });
                // key = 0;
                for (key in events) {
                    if (events.hasOwnProperty(key)) {
                        $(element).delegate(selectors, events[key] + '.h5Validate', validate);
                    }
                }
                return element;
            },
            /**
             * Prepare for event delegation.
             *
             * @param {object} settings The full plugin state, including
             * options.
             *
             * @returns {object} jQuery object for chaining.
             */
            bindDelegation: function (settings) {
                var $this = $(this),
                    $forms;
                // Attach patterns from the library to elements.
                // **TODO: pattern / validation method matching should
                // take place inside the validate action.
                $.each(patternLibrary, function (key, value) {
                    var pattern = value.toString();
                    pattern = pattern.substring(1, pattern.length - 1);
                    $('.' + settings.classPrefix + key).attr('pattern', pattern);
                });

                $forms = $this.filter('form')
                        .add($this.find('form'))
                        .add($this.parents('form'));

                $forms
                    .attr('novalidate', 'novalidate')
                    .submit(checkValidityOnSubmitHandler);

                $forms.find("input[formnovalidate][type='submit']").click(function(){
                    $(this).closest("form").unbind('submit', checkValidityOnSubmitHandler);
                });

                return this.each(function () {
                    var kbEvents = {
                            focusout: settings.focusout,
                            focusin: settings.focusin,
                            change: settings.change,
                            keyup: settings.keyup
                        },
                        mEvents = {
                            click: settings.click
                        },
                        activeEvents = {
                            keyup: settings.activeKeyup
                        };

                    settings.delegateEvents(':input', settings.customEvents, this, settings);
                    settings.delegateEvents(settings.kbSelectors, kbEvents, this, settings);
                    settings.delegateEvents(settings.mSelectors, mEvents, this, settings);
                    settings.delegateEvents(settings.activeClassSelector, activeEvents, this, settings);
                    settings.delegateEvents('textarea[maxlength]', {keyup: true}, this, settings);
                });
            }
        },

        /**
         * Event handler for the form submit event.
         * When settings.submit is enabled:
         *  - prevents submission if any invalid fields are found.
         *  - Optionally validates all fields.
         *  - Optionally moves focus to the first invalid field.
         *
         * @param {object} evt The jQuery Event object as from the submit event.
         *
         * @returns {object} undefined if no validation was done, true if validation passed, false if validation didn't.
         */
        checkValidityOnSubmitHandler = function(evt) {

            var $this,
                settings = getInstance.call(this),
                allValid;

            if(settings.submit !== true) {
                return;
            }

            $this = $(this);
            allValid = $this.h5Validate('allValid', { revalidate: settings.validateOnSubmit === true });

            if(allValid !== true) {
                evt.preventDefault();

                if(settings.focusFirstInvalidElementOnSubmit === true){
                    var $invalid = $(settings.allValidSelectors, $this)
                                    .filter(function(index){
                                        return $(this).h5Validate('isValid', { revalidate: false }) !== true;
                                    });

                    $invalid.first().focus();
                }
            }

            return allValid;
        },

        instances = [],

        buildSettings = function buildSettings(options) {
            // Combine defaults and options to get current settings.
            var settings = $.extend({}, defaults, options, methods),
                activeClass = settings.classPrefix + settings.activeClass;

            return $.extend(settings, {
                activeClass: activeClass,
                activeClassSelector: '.' + activeClass,
                requiredClass: settings.classPrefix + settings.requiredClass,
                el: this
            });
        },

        getInstance = function getInstance() {
            var $parent = $(this).closest('[data-h5-instanceId]');
            return instances[$parent.attr('data-h5-instanceId')];
        },

        setInstance = function setInstance(settings) {
            var instanceId = instances.push(settings) - 1;
            if (settings.RODom !== true) {
                $(this).attr('data-h5-instanceId', instanceId);
            }
            $(this).trigger('instance', { 'data-h5-instanceId': instanceId });
        };

    $.h5Validate = {
        /**
         * Take a map of pattern names and HTML5-compatible regular
         * expressions, and add them to the patternLibrary. Patterns in
         * the library are automatically assigned to HTML element pattern
         * attributes for validation.
         *
         * @param {Object} patterns A map of pattern names and HTML5 compatible
         * regular expressions.
         *
         * @returns {Object} patternLibrary The modified pattern library
         */
        addPatterns: function (patterns) {
            var patternLibrary = defaults.patternLibrary,
                key;
            for (key in patterns) {
                if (patterns.hasOwnProperty(key)) {
                    patternLibrary[key] = patterns[key];
                }
            }
            return patternLibrary;
        },
        /**
         * Take a valid jQuery selector, and a list of valid values to
         * validate against.
         * If the user input isn't in the list, validation fails.
         *
         * @param {String} selector Any valid jQuery selector.
         *
         * @param {Array} values A list of valid values to validate selected
         * fields against.
         */
        validValues: function (selector, values) {
            var i = 0,
                ln = values.length,
                pattern = '',
                re;
            // Build regex pattern
            for (i = 0; i < ln; i += 1) {
                pattern = pattern ? pattern + '|' + values[i] : values[i];
            }
            re = new RegExp('^(?:' + pattern + ')$');
            $(selector).data('regex', re);
        }
    };

    $.fn.h5Validate = function h5Validate(options) {
        var action,
            args,
            settings;

        if (typeof options === 'string' && typeof methods[options] === 'function') {
            // Whoah, hold on there! First we need to get the instance:
            settings = getInstance.call(this);

            args = [].slice.call(arguments, 0);
            action = options;
            args.shift();
            args = $.merge([settings], args);

            // Use settings here so we can plug methods into the instance dynamically?
            return settings[action].apply(this, args);
        }

        settings = buildSettings.call(this, options);
        setInstance.call(this, settings);

        // Returning the jQuery object allows for method chaining.
        return methods.bindDelegation.call(this, settings);
    };
});

define('plugins/main',[
    './jquery-h5validate'
], function () {
    
    return {};
});

define('plugins', ['plugins/main'], function (main) { return main; });

define('form/form',[
    'jquery',
    'options',
    'plugins'
], function ($, options) {
    

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

/*jshint unused: false */
define('form/main',[
    'jquery',
    './form',
], function ( $, Form, options) {
    


    return new Form();
});

define('form', ['form/main'], function (main) { return main; });

// jquery.pjax.js
// copyright chris wanstrath
// https://github.com/defunkt/jquery-pjax

(function($){

// When called on a container with a selector, fetches the href with
// ajax into the container or with the data-pjax attribute on the link
// itself.
//
// Tries to make sure the back button and ctrl+click work the way
// you'd expect.
//
// Exported as $.fn.pjax
//
// Accepts a jQuery ajax options object that may include these
// pjax specific options:
//
//
// container - Where to stick the response body. Usually a String selector.
//             $(container).html(xhr.responseBody)
//             (default: current jquery context)
//      push - Whether to pushState the URL. Defaults to true (of course).
//   replace - Want to use replaceState instead? That's cool.
//
// For convenience the second parameter can be either the container or
// the options object.
//
// Returns the jQuery object
function fnPjax(selector, container, options) {
  var context = this
  return this.on('click.pjax', selector, function(event) {
    var opts = $.extend({}, optionsFor(container, options))
    if (!opts.container)
      opts.container = $(this).attr('data-pjax') || context
    handleClick(event, opts)
  })
}

// Public: pjax on click handler
//
// Exported as $.pjax.click.
//
// event   - "click" jQuery.Event
// options - pjax options
//
// Examples
//
//   $(document).on('click', 'a', $.pjax.click)
//   // is the same as
//   $(document).pjax('a')
//
//  $(document).on('click', 'a', function(event) {
//    var container = $(this).closest('[data-pjax-container]')
//    $.pjax.click(event, container)
//  })
//
// Returns nothing.
function handleClick(event, container, options) {
  options = optionsFor(container, options)

  var link = event.currentTarget

  if (link.tagName.toUpperCase() !== 'A')
    throw "$.fn.pjax or $.pjax.click requires an anchor element"

  // Middle click, cmd click, and ctrl click should open
  // links in a new tab as normal.
  if ( event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey )
    return

  // Ignore cross origin links
  if ( location.protocol !== link.protocol || location.hostname !== link.hostname )
    return

  // Ignore anchors on the same page
  if (link.hash && link.href.replace(link.hash, '') ===
       location.href.replace(location.hash, ''))
    return

  // Ignore empty anchor "foo.html#"
  if (link.href === location.href + '#')
    return

  var defaults = {
    url: link.href,
    container: $(link).attr('data-pjax'),
    target: link
  }

  var opts = $.extend({}, defaults, options)
  var clickEvent = $.Event('pjax:click')
  $(link).trigger(clickEvent, [opts])

  if (!clickEvent.isDefaultPrevented()) {
    pjax(opts)
    event.preventDefault()
    $(link).trigger('pjax:clicked', [opts])
  }
}

// Public: pjax on form submit handler
//
// Exported as $.pjax.submit
//
// event   - "click" jQuery.Event
// options - pjax options
//
// Examples
//
//  $(document).on('submit', 'form', function(event) {
//    var container = $(this).closest('[data-pjax-container]')
//    $.pjax.submit(event, container)
//  })
//
// Returns nothing.
function handleSubmit(event, container, options) {
  options = optionsFor(container, options)

  var form = event.currentTarget

  if (form.tagName.toUpperCase() !== 'FORM')
    throw "$.pjax.submit requires a form element"

  var defaults = {
    type: form.method.toUpperCase(),
    url: form.action,
    data: $(form).serializeArray(),
    container: $(form).attr('data-pjax'),
    target: form
  }

  pjax($.extend({}, defaults, options))

  event.preventDefault()
}

// Loads a URL with ajax, puts the response body inside a container,
// then pushState()'s the loaded URL.
//
// Works just like $.ajax in that it accepts a jQuery ajax
// settings object (with keys like url, type, data, etc).
//
// Accepts these extra keys:
//
// container - Where to stick the response body.
//             $(container).html(xhr.responseBody)
//      push - Whether to pushState the URL. Defaults to true (of course).
//   replace - Want to use replaceState instead? That's cool.
//
// Use it just like $.ajax:
//
//   var xhr = $.pjax({ url: this.href, container: '#main' })
//   console.log( xhr.readyState )
//
// Returns whatever $.ajax returns.
function pjax(options) {
  options = $.extend(true, {}, $.ajaxSettings, pjax.defaults, options)

  if ($.isFunction(options.url)) {
    options.url = options.url()
  }

  var target = options.target

  var hash = parseURL(options.url).hash

  var context = options.context = findContainerFor(options.container)

  // We want the browser to maintain two separate internal caches: one
  // for pjax'd partial page loads and one for normal page loads.
  // Without adding this secret parameter, some browsers will often
  // confuse the two.
  if (!options.data) options.data = {}
  options.data._pjax = context.selector

  function fire(type, args) {
    var event = $.Event(type, { relatedTarget: target })
    context.trigger(event, args)
    return !event.isDefaultPrevented()
  }

  var timeoutTimer

  options.beforeSend = function(xhr, settings) {
    // No timeout for non-GET requests
    // Its not safe to request the resource again with a fallback method.
    if (settings.type !== 'GET') {
      settings.timeout = 0
    }

    xhr.setRequestHeader('X-PJAX', 'true')
    xhr.setRequestHeader('X-PJAX-Container', context.selector)

    if (!fire('pjax:beforeSend', [xhr, settings]))
      return false

    if (settings.timeout > 0) {
      timeoutTimer = setTimeout(function() {
        if (fire('pjax:timeout', [xhr, options]))
          xhr.abort('timeout')
      }, settings.timeout)

      // Clear timeout setting so jquerys internal timeout isn't invoked
      settings.timeout = 0
    }

    options.requestUrl = parseURL(settings.url).href
  }

  options.complete = function(xhr, textStatus) {
    if (timeoutTimer)
      clearTimeout(timeoutTimer)

    fire('pjax:complete', [xhr, textStatus, options])

    fire('pjax:end', [xhr, options])
  }

  options.error = function(xhr, textStatus, errorThrown) {
    var container = extractContainer("", xhr, options)

    var allowed = fire('pjax:error', [xhr, textStatus, errorThrown, options])
    if (options.type == 'GET' && textStatus !== 'abort' && allowed) {
      locationReplace(container.url)
    }
  }

  options.success = function(data, status, xhr) {
    // If $.pjax.defaults.version is a function, invoke it first.
    // Otherwise it can be a static string.
    var currentVersion = (typeof $.pjax.defaults.version === 'function') ?
      $.pjax.defaults.version() :
      $.pjax.defaults.version

    var latestVersion = xhr.getResponseHeader('X-PJAX-Version')

    var container = extractContainer(data, xhr, options)

    // If there is a layout version mismatch, hard load the new url
    if (currentVersion && latestVersion && currentVersion !== latestVersion) {
      locationReplace(container.url)
      return
    }

    // If the new response is missing a body, hard load the page
    if (!container.contents) {
      locationReplace(container.url)
      return
    }

    pjax.state = {
      id: options.id || uniqueId(),
      url: container.url,
      title: container.title,
      container: context.selector,
      fragment: options.fragment,
      timeout: options.timeout
    }

    if (options.push || options.replace) {
      window.history.replaceState(pjax.state, container.title, container.url)
    }

    // Clear out any focused controls before inserting new page contents.
    try {
      document.activeElement.blur()
    } catch (e) { }

    if (container.title) document.title = container.title
    context.html(container.contents)

    // FF bug: Won't autofocus fields that are inserted via JS.
    // This behavior is incorrect. So if theres no current focus, autofocus
    // the last field.
    //
    // http://www.w3.org/html/wg/drafts/html/master/forms.html
    var autofocusEl = context.find('input[autofocus], textarea[autofocus]').last()[0]
    if (autofocusEl && document.activeElement !== autofocusEl) {
      autofocusEl.focus();
    }

    executeScriptTags(container.scripts)

    // Scroll to top by default
    if (typeof options.scrollTo === 'number')
      $(window).scrollTop(options.scrollTo)

    // If the URL has a hash in it, make sure the browser
    // knows to navigate to the hash.
    if ( hash !== '' ) {
      // Avoid using simple hash set here. Will add another history
      // entry. Replace the url with replaceState and scroll to target
      // by hand.
      //
      //   window.location.hash = hash
      var url = parseURL(container.url)
      url.hash = hash

      pjax.state.url = url.href
      window.history.replaceState(pjax.state, container.title, url.href)

      var target = $(url.hash)
      if (target.length) $(window).scrollTop(target.offset().top)
    }

    fire('pjax:success', [data, status, xhr, options])
  }


  // Initialize pjax.state for the initial page load. Assume we're
  // using the container and options of the link we're loading for the
  // back button to the initial page. This ensures good back button
  // behavior.
  if (!pjax.state) {
    pjax.state = {
      id: uniqueId(),
      url: window.location.href,
      title: document.title,
      container: context.selector,
      fragment: options.fragment,
      timeout: options.timeout
    }
    window.history.replaceState(pjax.state, document.title)
  }

  // Cancel the current request if we're already pjaxing
  var xhr = pjax.xhr
  if ( xhr && xhr.readyState < 4) {
    xhr.onreadystatechange = $.noop
    xhr.abort()
  }

  pjax.options = options
  var xhr = pjax.xhr = $.ajax(options)

  if (xhr.readyState > 0) {
    if (options.push && !options.replace) {
      // Cache current container element before replacing it
      cachePush(pjax.state.id, context.clone().contents())

      window.history.pushState(null, "", stripPjaxParam(options.requestUrl))
    }

    fire('pjax:start', [xhr, options])
    fire('pjax:send', [xhr, options])
  }

  return pjax.xhr
}

// Public: Reload current page with pjax.
//
// Returns whatever $.pjax returns.
function pjaxReload(container, options) {
  var defaults = {
    url: window.location.href,
    push: false,
    replace: true,
    scrollTo: false
  }

  return pjax($.extend(defaults, optionsFor(container, options)))
}

// Internal: Hard replace current state with url.
//
// Work for around WebKit
//   https://bugs.webkit.org/show_bug.cgi?id=93506
//
// Returns nothing.
function locationReplace(url) {
  window.history.replaceState(null, "", "#")
  window.location.replace(url)
}


var initialPop = true
var initialURL = window.location.href
var initialState = window.history.state

// Initialize $.pjax.state if possible
// Happens when reloading a page and coming forward from a different
// session history.
if (initialState && initialState.container) {
  pjax.state = initialState
}

// Non-webkit browsers don't fire an initial popstate event
if ('state' in window.history) {
  initialPop = false
}

// popstate handler takes care of the back and forward buttons
//
// You probably shouldn't use pjax on pages with other pushState
// stuff yet.
function onPjaxPopstate(event) {
  var state = event.state

  if (state && state.container) {
    // When coming forward from a separate history session, will get an
    // initial pop with a state we are already at. Skip reloading the current
    // page.
    if (initialPop && initialURL == state.url) return

    // If popping back to the same state, just skip.
    // Could be clicking back from hashchange rather than a pushState.
    if (pjax.state && pjax.state.id === state.id) return

    var container = $(state.container)
    if (container.length) {
      var direction, contents = cacheMapping[state.id]

      if (pjax.state) {
        // Since state ids always increase, we can deduce the history
        // direction from the previous state.
        direction = pjax.state.id < state.id ? 'forward' : 'back'

        // Cache current container before replacement and inform the
        // cache which direction the history shifted.
        cachePop(direction, pjax.state.id, container.clone().contents())
      }

      var popstateEvent = $.Event('pjax:popstate', {
        state: state,
        direction: direction
      })
      container.trigger(popstateEvent)

      var options = {
        id: state.id,
        url: state.url,
        container: container,
        push: false,
        fragment: state.fragment,
        timeout: state.timeout,
        scrollTo: false
      }

      if (contents) {
        container.trigger('pjax:start', [null, options])

        if (state.title) document.title = state.title
        container.html(contents)
        pjax.state = state

        container.trigger('pjax:end', [null, options])
      } else {
        pjax(options)
      }

      // Force reflow/relayout before the browser tries to restore the
      // scroll position.
      container[0].offsetHeight
    } else {
      locationReplace(location.href)
    }
  }
  initialPop = false
}

// Fallback version of main pjax function for browsers that don't
// support pushState.
//
// Returns nothing since it retriggers a hard form submission.
function fallbackPjax(options) {
  var url = $.isFunction(options.url) ? options.url() : options.url,
      method = options.type ? options.type.toUpperCase() : 'GET'

  var form = $('<form>', {
    method: method === 'GET' ? 'GET' : 'POST',
    action: url,
    style: 'display:none'
  })

  if (method !== 'GET' && method !== 'POST') {
    form.append($('<input>', {
      type: 'hidden',
      name: '_method',
      value: method.toLowerCase()
    }))
  }

  var data = options.data
  if (typeof data === 'string') {
    $.each(data.split('&'), function(index, value) {
      var pair = value.split('=')
      form.append($('<input>', {type: 'hidden', name: pair[0], value: pair[1]}))
    })
  } else if (typeof data === 'object') {
    for (key in data)
      form.append($('<input>', {type: 'hidden', name: key, value: data[key]}))
  }

  $(document.body).append(form)
  form.submit()
}

// Internal: Generate unique id for state object.
//
// Use a timestamp instead of a counter since ids should still be
// unique across page loads.
//
// Returns Number.
function uniqueId() {
  return (new Date).getTime()
}

// Internal: Strips _pjax param from url
//
// url - String
//
// Returns String.
function stripPjaxParam(url) {
  return url
    .replace(/\?_pjax=[^&]+&?/, '?')
    .replace(/_pjax=[^&]+&?/, '')
    .replace(/[\?&]$/, '')
}

// Internal: Parse URL components and returns a Locationish object.
//
// url - String URL
//
// Returns HTMLAnchorElement that acts like Location.
function parseURL(url) {
  var a = document.createElement('a')
  a.href = url
  return a
}

// Internal: Build options Object for arguments.
//
// For convenience the first parameter can be either the container or
// the options object.
//
// Examples
//
//   optionsFor('#container')
//   // => {container: '#container'}
//
//   optionsFor('#container', {push: true})
//   // => {container: '#container', push: true}
//
//   optionsFor({container: '#container', push: true})
//   // => {container: '#container', push: true}
//
// Returns options Object.
function optionsFor(container, options) {
  // Both container and options
  if ( container && options )
    options.container = container

  // First argument is options Object
  else if ( $.isPlainObject(container) )
    options = container

  // Only container
  else
    options = {container: container}

  // Find and validate container
  if (options.container)
    options.container = findContainerFor(options.container)

  return options
}

// Internal: Find container element for a variety of inputs.
//
// Because we can't persist elements using the history API, we must be
// able to find a String selector that will consistently find the Element.
//
// container - A selector String, jQuery object, or DOM Element.
//
// Returns a jQuery object whose context is `document` and has a selector.
function findContainerFor(container) {
  container = $(container)

  if ( !container.length ) {
    throw "no pjax container for " + container.selector
  } else if ( container.selector !== '' && container.context === document ) {
    return container
  } else if ( container.attr('id') ) {
    return $('#' + container.attr('id'))
  } else {
    throw "cant get selector for pjax container!"
  }
}

// Internal: Filter and find all elements matching the selector.
//
// Where $.fn.find only matches descendants, findAll will test all the
// top level elements in the jQuery object as well.
//
// elems    - jQuery object of Elements
// selector - String selector to match
//
// Returns a jQuery object.
function findAll(elems, selector) {
  return elems.filter(selector).add(elems.find(selector));
}

function parseHTML(html) {
  return $.parseHTML(html, document, true)
}

// Internal: Extracts container and metadata from response.
//
// 1. Extracts X-PJAX-URL header if set
// 2. Extracts inline <title> tags
// 3. Builds response Element and extracts fragment if set
//
// data    - String response data
// xhr     - XHR response
// options - pjax options Object
//
// Returns an Object with url, title, and contents keys.
function extractContainer(data, xhr, options) {
  var obj = {}

  // Prefer X-PJAX-URL header if it was set, otherwise fallback to
  // using the original requested url.
  obj.url = stripPjaxParam(xhr.getResponseHeader('X-PJAX-URL') || options.requestUrl)

  // Attempt to parse response html into elements
  if (/<html/i.test(data)) {
    var $head = $(parseHTML(data.match(/<head[^>]*>([\s\S.]*)<\/head>/i)[0]))
    var $body = $(parseHTML(data.match(/<body[^>]*>([\s\S.]*)<\/body>/i)[0]))
  } else {
    var $head = $body = $(parseHTML(data))
  }

  // If response data is empty, return fast
  if ($body.length === 0)
    return obj

  // If there's a <title> tag in the header, use it as
  // the page's title.
  obj.title = findAll($head, 'title').last().text()

  if (options.fragment) {
    // If they specified a fragment, look for it in the response
    // and pull it out.
    if (options.fragment === 'body') {
      var $fragment = $body
    } else {
      var $fragment = findAll($body, options.fragment).first()
    }

    if ($fragment.length) {
      obj.contents = $fragment.contents()

      // If there's no title, look for data-title and title attributes
      // on the fragment
      if (!obj.title)
        obj.title = $fragment.attr('title') || $fragment.data('title')
    }

  } else if (!/<html/i.test(data)) {
    obj.contents = $body
  }

  // Clean up any <title> tags
  if (obj.contents) {
    // Remove any parent title elements
    obj.contents = obj.contents.not(function() { return $(this).is('title') })

    // Then scrub any titles from their descendants
    obj.contents.find('title').remove()

    // Gather all script[src] elements
    obj.scripts = findAll(obj.contents, 'script[src]').remove()
    obj.contents = obj.contents.not(obj.scripts)
  }

  // Trim any whitespace off the title
  if (obj.title) obj.title = $.trim(obj.title)

  return obj
}

// Load an execute scripts using standard script request.
//
// Avoids jQuery's traditional $.getScript which does a XHR request and
// globalEval.
//
// scripts - jQuery object of script Elements
//
// Returns nothing.
function executeScriptTags(scripts) {
  if (!scripts) return

  var existingScripts = $('script[src]')

  scripts.each(function() {
    var src = this.src
    var matchedScripts = existingScripts.filter(function() {
      return this.src === src
    })
    if (matchedScripts.length) return

    var script = document.createElement('script')
    script.type = $(this).attr('type')
    script.src = $(this).attr('src')
    document.head.appendChild(script)
  })
}

// Internal: History DOM caching class.
var cacheMapping      = {}
var cacheForwardStack = []
var cacheBackStack    = []

// Push previous state id and container contents into the history
// cache. Should be called in conjunction with `pushState` to save the
// previous container contents.
//
// id    - State ID Number
// value - DOM Element to cache
//
// Returns nothing.
function cachePush(id, value) {
  cacheMapping[id] = value
  cacheBackStack.push(id)

  // Remove all entires in forward history stack after pushing
  // a new page.
  while (cacheForwardStack.length)
    delete cacheMapping[cacheForwardStack.shift()]

  // Trim back history stack to max cache length.
  while (cacheBackStack.length > pjax.defaults.maxCacheLength)
    delete cacheMapping[cacheBackStack.shift()]
}

// Shifts cache from directional history cache. Should be
// called on `popstate` with the previous state id and container
// contents.
//
// direction - "forward" or "back" String
// id        - State ID Number
// value     - DOM Element to cache
//
// Returns nothing.
function cachePop(direction, id, value) {
  var pushStack, popStack
  cacheMapping[id] = value

  if (direction === 'forward') {
    pushStack = cacheBackStack
    popStack  = cacheForwardStack
  } else {
    pushStack = cacheForwardStack
    popStack  = cacheBackStack
  }

  pushStack.push(id)
  if (id = popStack.pop())
    delete cacheMapping[id]
}

// Public: Find version identifier for the initial page load.
//
// Returns String version or undefined.
function findVersion() {
  return $('meta').filter(function() {
    var name = $(this).attr('http-equiv')
    return name && name.toUpperCase() === 'X-PJAX-VERSION'
  }).attr('content')
}

// Install pjax functions on $.pjax to enable pushState behavior.
//
// Does nothing if already enabled.
//
// Examples
//
//     $.pjax.enable()
//
// Returns nothing.
function enable() {
  $.fn.pjax = fnPjax
  $.pjax = pjax
  $.pjax.enable = $.noop
  $.pjax.disable = disable
  $.pjax.click = handleClick
  $.pjax.submit = handleSubmit
  $.pjax.reload = pjaxReload
  $.pjax.defaults = {
    timeout: 650,
    push: true,
    replace: false,
    type: 'GET',
    dataType: 'html',
    scrollTo: 0,
    maxCacheLength: 20,
    version: findVersion
  }
  $(window).on('popstate.pjax', onPjaxPopstate)
}

// Disable pushState behavior.
//
// This is the case when a browser doesn't support pushState. It is
// sometimes useful to disable pushState for debugging on a modern
// browser.
//
// Examples
//
//     $.pjax.disable()
//
// Returns nothing.
function disable() {
  $.fn.pjax = function() { return this }
  $.pjax = fallbackPjax
  $.pjax.enable = enable
  $.pjax.disable = $.noop
  $.pjax.click = $.noop
  $.pjax.submit = $.noop
  $.pjax.reload = function() { window.location.reload() }

  $(window).off('popstate.pjax', onPjaxPopstate)
}


// Add the state property to jQuery's event object so we can use it in
// $(window).bind('popstate')
if ( $.inArray('state', $.event.props) < 0 )
  $.event.props.push('state')

// Is pjax supported by this browser?
$.support.pjax =
  window.history && window.history.pushState && window.history.replaceState &&
  // pushState isn't reliable on iOS until 5.
  !navigator.userAgent.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]|WebApps\/.+CFNetwork)/)

$.support.pjax ? enable() : disable()

})(jQuery);

define("pjax", function(){});

/*global
    Modernizr
*/
define('troubleshooter/troubleshooter',[
    'jquery',
    'options',
    'pubsubBreakpoints',
    'pjax',
    'pubsub'
], function ($, options, pubsub, pjax) {
    

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

/*jshint unused: false */
define('troubleshooter/main',[
    'jquery',
    './troubleshooter',
], function ( $, Troubleshooter, options) {
    


    return new Troubleshooter();
});

define('troubleshooter', ['troubleshooter/main'], function (main) { return main; });

/*global
    Modernizr
*/
define('pagination/pagination',[
    'jquery',
    'options',
    'pjax',
    'pubsub'
], function ($, options, pjax) {
    

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

/*jshint unused: false */
define('pagination/main',[
    'jquery',
    './pagination',
], function ( $, Pagination, options) {
    


    return new Pagination();
});

define('pagination', ['pagination/main'], function (main) { return main; });

/* jshint undef: true, boss: true */
define('polyfills/log',['window'], function (global) {
    
    /**
     * make it safe to use console.log always
     */
    (function (b) {
        var a, c, d, _results;
        c = function () {
        };
        d = 'assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,timeStamp,profile,profileEnd,time,timeEnd,trace,warn'.split(',');
        a = void 0;
        _results = [];
        while (a = d.pop()) {
            _results.push(b[a] = b[a] || c);
        }
        return _results;
    })((function () {
            try {
                console.log();
                return global.console;
            } catch (err) {
                return global.console = {};
            }
        })());

    /**
     * usage: log('inside coolFunc',this,arguments);
     * paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
     */
    global.log = function () {
        global.log.history = global.log.history || [];
        global.log.history.push(arguments);
        if (global.console) {
            return console.log(Array.prototype.slice.call(arguments));
        }
    };
});

/* 
 * The MIT License
 *
 * Copyright (c) 2012 James Allardice
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// Defines the global Placeholders object along with various utility methods
define('polyfills/placeholders',['window'], function (global) {
    

    (function (global) {

        // Cross-browser DOM event binding
        function addEventListener(elem, event, fn) {
            if (elem.addEventListener) {
                return elem.addEventListener(event, fn, false);
            }
            if (elem.attachEvent) {
                return elem.attachEvent('on' + event, fn);
            }
        }

        // Check whether an item is in an array (we don't use Array.prototype.indexOf so we don't clobber any existing polyfills - this is a really simple alternative)
        function inArray(arr, item) {
            var i, len;
            for (i = 0, len = arr.length; i < len; i++) {
                if (arr[i] === item) {
                    return true;
                }
            }
            return false;
        }

        // Move the caret to the index position specified. Assumes that the element has focus
        function moveCaret(elem, index) {
            var range;
            if (elem.createTextRange) {
                range = elem.createTextRange();
                range.move('character', index);
                range.select();
            } else if (elem.selectionStart) {
                elem.focus();
                elem.setSelectionRange(index, index);
            }
        }

        // Attempt to change the type property of an input element
        function changeType(elem, type) {
            try {
                elem.type = type;
                return true;
            } catch (e) {
                // You can't change input type in IE8 and below
                return false;
            }
        }

        // Expose public methods
        global.Placeholders = {
            Utils: {
                addEventListener: addEventListener,
                inArray: inArray,
                moveCaret: moveCaret,
                changeType: changeType
            }
        };

    }(global));

    (function (global) {

        var validTypes = [
                'text',
                'search',
                'url',
                'tel',
                'email',
                'password',
                'number',
                'textarea'
            ],

        // The list of keycodes that are not allowed when the polyfill is configured to hide-on-input
            badKeys = [

                // The following keys all cause the caret to jump to the end of the input value
                27, // Escape
                33, // Page up
                34, // Page down
                35, // End
                36, // Home

                // Arrow keys allow you to move the caret manually, which should be prevented when the placeholder is visible
                37, // Left
                38, // Up
                39, // Right
                40, // Down

                // The following keys allow you to modify the placeholder text by removing characters, which should be prevented when the placeholder is visible
                8, // Backspace
                46 // Delete
            ],

        // Styling variables
            placeholderStyleColor = '#ccc',
            placeholderClassName = 'placeholdersjs',
            classNameRegExp = new RegExp('(?:^|\\s)' + placeholderClassName + '(?!\\S)'),

        // These will hold references to all elements that can be affected. NodeList objects are live, so we only need to get those references once
            inputs, textareas,

        // The various data-* attributes used by the polyfill
            ATTR_CURRENT_VAL = 'data-placeholder-value',
            ATTR_ACTIVE = 'data-placeholder-active',
            ATTR_INPUT_TYPE = 'data-placeholder-type',
            ATTR_FORM_HANDLED = 'data-placeholder-submit',
            ATTR_EVENTS_BOUND = 'data-placeholder-bound',
            ATTR_OPTION_FOCUS = 'data-placeholder-focus',
            ATTR_OPTION_LIVE = 'data-placeholder-live',
            ATTR_MAXLENGTH = 'data-placeholder-maxlength',

        // Various other variables used throughout the rest of the script
            test = document.createElement('input'),
            head = document.getElementsByTagName('head')[0],
            root = document.documentElement,
            Placeholders = global.Placeholders,
            Utils = Placeholders.Utils,
            hideOnInput, liveUpdates, keydownVal, styleElem, styleRules, placeholder, timer, form, elem, len, i;

        // No-op (used in place of public methods when native support is detected)
        function noop() {
        }

        // Avoid IE9 activeElement of death when an iframe is used.
        // More info:
        // http://bugs.jquery.com/ticket/13393
        // https://github.com/jquery/jquery/commit/85fc5878b3c6af73f42d61eedf73013e7faae408
        function safeActiveElement() {
            try {
                return document.activeElement;
            } catch (err) {
            }
        }

        // Hide the placeholder value on a single element. Returns true if the placeholder was hidden and false if it was not (because it wasn't visible in the first place)
        function hidePlaceholder(elem, keydownValue) {
            var type,
                maxLength,
                valueChanged = (!!keydownValue && elem.value !== keydownValue),
                isPlaceholderValue = (elem.value === elem.getAttribute(ATTR_CURRENT_VAL));

            if ((valueChanged || isPlaceholderValue) && elem.getAttribute(ATTR_ACTIVE) === 'true') {
                elem.removeAttribute(ATTR_ACTIVE);
                elem.value = elem.value.replace(elem.getAttribute(ATTR_CURRENT_VAL), '');
                elem.className = elem.className.replace(classNameRegExp, '');

                // Restore the maxlength value
                maxLength = elem.getAttribute(ATTR_MAXLENGTH);
                if (parseInt(maxLength, 10) >= 0) { // Old FF returns -1 if attribute not set (see GH-56)
                    elem.setAttribute('maxLength', maxLength);
                    elem.removeAttribute(ATTR_MAXLENGTH);
                }

                // If the polyfill has changed the type of the element we need to change it back
                type = elem.getAttribute(ATTR_INPUT_TYPE);
                if (type) {
                    elem.type = type;
                }
                return true;
            }
            return false;
        }

        // Show the placeholder value on a single element. Returns true if the placeholder was shown and false if it was not (because it was already visible)
        function showPlaceholder(elem) {
            var type,
                maxLength,
                val = elem.getAttribute(ATTR_CURRENT_VAL);
            if (elem.value === '' && val) {
                elem.setAttribute(ATTR_ACTIVE, 'true');
                elem.value = val;
                elem.className += ' ' + placeholderClassName;

                // Store and remove the maxlength value
                maxLength = elem.getAttribute(ATTR_MAXLENGTH);
                if (!maxLength) {
                    elem.setAttribute(ATTR_MAXLENGTH, elem.maxLength);
                    elem.removeAttribute('maxLength');
                }

                // If the type of element needs to change, change it (e.g. password inputs)
                type = elem.getAttribute(ATTR_INPUT_TYPE);
                if (type) {
                    elem.type = 'text';
                } else if (elem.type === 'password') {
                    if (Utils.changeType(elem, 'text')) {
                        elem.setAttribute(ATTR_INPUT_TYPE, 'password');
                    }
                }
                return true;
            }
            return false;
        }

        function handleElem(node, callback) {

            var handleInputsLength, handleTextareasLength, handleInputs, handleTextareas, elem, len, i;

            // Check if the passed in node is an input/textarea (in which case it can't have any affected descendants)
            if (node && node.getAttribute(ATTR_CURRENT_VAL)) {
                callback(node);
            } else {

                // If an element was passed in, get all affected descendants. Otherwise, get all affected elements in document
                handleInputs = node ? node.getElementsByTagName('input') : inputs;
                handleTextareas = node ? node.getElementsByTagName('textarea') : textareas;

                handleInputsLength = handleInputs ? handleInputs.length : 0;
                handleTextareasLength = handleTextareas ? handleTextareas.length : 0;

                // Run the callback for each element
                for (i = 0, len = handleInputsLength + handleTextareasLength; i < len; i++) {
                    elem = i < handleInputsLength ? handleInputs[i] : handleTextareas[i - handleInputsLength];
                    callback(elem);
                }
            }
        }

        // Return all affected elements to their normal state (remove placeholder value if present)
        function disablePlaceholders(node) {
            handleElem(node, hidePlaceholder);
        }

        // Show the placeholder value on all appropriate elements
        function enablePlaceholders(node) {
            handleElem(node, showPlaceholder);
        }

        // Returns a function that is used as a focus event handler
        function makeFocusHandler(elem) {
            return function () {

                // Only hide the placeholder value if the (default) hide-on-focus behaviour is enabled
                if (hideOnInput && elem.value === elem.getAttribute(ATTR_CURRENT_VAL) && elem.getAttribute(ATTR_ACTIVE) === 'true') {

                    // Move the caret to the start of the input (this mimics the behaviour of all browsers that do not hide the placeholder on focus)
                    Utils.moveCaret(elem, 0);

                } else {

                    // Remove the placeholder
                    hidePlaceholder(elem);
                }
            };
        }

        // Returns a function that is used as a blur event handler
        function makeBlurHandler(elem) {
            return function () {
                showPlaceholder(elem);
            };
        }

        // Functions that are used as a event handlers when the hide-on-input behaviour has been activated - very basic implementation of the 'input' event
        function makeKeydownHandler(elem) {
            return function (e) {
                keydownVal = elem.value;

                //Prevent the use of the arrow keys (try to keep the cursor before the placeholder)
                if (elem.getAttribute(ATTR_ACTIVE) === 'true') {
                    if (keydownVal === elem.getAttribute(ATTR_CURRENT_VAL) && Utils.inArray(badKeys, e.keyCode)) {
                        if (e.preventDefault) {
                            e.preventDefault();
                        }
                        return false;
                    }
                }
            };
        }

        function makeKeyupHandler(elem) {
            return function () {
                hidePlaceholder(elem, keydownVal);

                // If the element is now empty we need to show the placeholder
                if (elem.value === '') {
                    elem.blur();
                    Utils.moveCaret(elem, 0);
                }
            };
        }

        function makeClickHandler(elem) {
            return function () {
                if (elem === safeActiveElement() && elem.value === elem.getAttribute(ATTR_CURRENT_VAL) && elem.getAttribute(ATTR_ACTIVE) === 'true') {
                    Utils.moveCaret(elem, 0);
                }
            };
        }

        // Returns a function that is used as a submit event handler on form elements that have children affected by this polyfill
        function makeSubmitHandler(form) {
            return function () {

                // Turn off placeholders on all appropriate descendant elements
                disablePlaceholders(form);
            };
        }

        // Bind event handlers to an element that we need to affect with the polyfill
        function newElement(elem) {

            // If the element is part of a form, make sure the placeholder string is not submitted as a value
            if (elem.form) {
                form = elem.form;

                // If the type of the property is a string then we have a 'form' attribute and need to get the real form
                if (typeof form === 'string') {
                    form = document.getElementById(form);
                }

                // Set a flag on the form so we know it's been handled (forms can contain multiple inputs)
                if (!form.getAttribute(ATTR_FORM_HANDLED)) {
                    Utils.addEventListener(form, 'submit', makeSubmitHandler(form));
                    form.setAttribute(ATTR_FORM_HANDLED, 'true');
                }
            }

            // Bind event handlers to the element so we can hide/show the placeholder as appropriate
            Utils.addEventListener(elem, 'focus', makeFocusHandler(elem));
            Utils.addEventListener(elem, 'blur', makeBlurHandler(elem));

            // If the placeholder should hide on input rather than on focus we need additional event handlers
            if (hideOnInput) {
                Utils.addEventListener(elem, 'keydown', makeKeydownHandler(elem));
                Utils.addEventListener(elem, 'keyup', makeKeyupHandler(elem));
                Utils.addEventListener(elem, 'click', makeClickHandler(elem));
            }

            // Remember that we've bound event handlers to this element
            elem.setAttribute(ATTR_EVENTS_BOUND, 'true');
            elem.setAttribute(ATTR_CURRENT_VAL, placeholder);

            // If the element doesn't have a value and is not focussed, set it to the placeholder string
            if (hideOnInput || elem !== safeActiveElement()) {
                showPlaceholder(elem);
            }
        }

        Placeholders.nativeSupport = test.placeholder !== void 0;

        if (!Placeholders.nativeSupport) {

            // Get references to all the input and textarea elements currently in the DOM (live NodeList objects to we only need to do this once)
            inputs = document.getElementsByTagName('input');
            textareas = document.getElementsByTagName('textarea');

            // Get any settings declared as data-* attributes on the root element (currently the only options are whether to hide the placeholder on focus or input and whether to auto-update)
            hideOnInput = root.getAttribute(ATTR_OPTION_FOCUS) === 'false';
            liveUpdates = root.getAttribute(ATTR_OPTION_LIVE) !== 'false';

            // Create style element for placeholder styles (instead of directly setting style properties on elements - allows for better flexibility alongside user-defined styles)
            styleElem = document.createElement('style');
            styleElem.type = 'text/css';

            // Create style rules as text node
            styleRules = document.createTextNode('.' + placeholderClassName + ' { color:' + placeholderStyleColor + '; }');

            // Append style rules to newly created stylesheet
            if (styleElem.styleSheet) {
                styleElem.styleSheet.cssText = styleRules.nodeValue;
            } else {
                styleElem.appendChild(styleRules);
            }

            // Prepend new style element to the head (before any existing stylesheets, so user-defined rules take precedence)
            head.insertBefore(styleElem, head.firstChild);

            // Set up the placeholders
            for (i = 0, len = inputs.length + textareas.length; i < len; i++) {
                elem = i < inputs.length ? inputs[i] : textareas[i - inputs.length];

                // Get the value of the placeholder attribute, if any. IE10 emulating IE7 fails with getAttribute, hence the use of the attributes node
                placeholder = elem.attributes.placeholder;
                if (placeholder) {

                    // IE returns an empty object instead of undefined if the attribute is not present
                    placeholder = placeholder.nodeValue;

                    // Only apply the polyfill if this element is of a type that supports placeholders, and has a placeholder attribute with a non-empty value
                    if (placeholder && Utils.inArray(validTypes, elem.type)) {
                        newElement(elem);
                    }
                }
            }

            // If enabled, the polyfill will repeatedly check for changed/added elements and apply to those as well
            timer = setInterval(function () {
                for (i = 0, len = inputs.length + textareas.length; i < len; i++) {
                    elem = i < inputs.length ? inputs[i] : textareas[i - inputs.length];

                    // Only apply the polyfill if this element is of a type that supports placeholders, and has a placeholder attribute with a non-empty value
                    placeholder = elem.attributes.placeholder;
                    if (placeholder) {
                        placeholder = placeholder.nodeValue;
                        if (placeholder && Utils.inArray(validTypes, elem.type)) {

                            // If the element hasn't had event handlers bound to it then add them
                            if (!elem.getAttribute(ATTR_EVENTS_BOUND)) {
                                newElement(elem);
                            }

                            // If the placeholder value has changed or not been initialised yet we need to update the display
                            if (placeholder !== elem.getAttribute(ATTR_CURRENT_VAL) || (elem.type === 'password' && !elem.getAttribute(ATTR_INPUT_TYPE))) {

                                // Attempt to change the type of password inputs (fails in IE < 9)
                                if (elem.type === 'password' && !elem.getAttribute(ATTR_INPUT_TYPE) && Utils.changeType(elem, 'text')) {
                                    elem.setAttribute(ATTR_INPUT_TYPE, 'password');
                                }

                                // If the placeholder value has changed and the placeholder is currently on display we need to change it
                                if (elem.value === elem.getAttribute(ATTR_CURRENT_VAL)) {
                                    elem.value = placeholder;
                                }

                                // Keep a reference to the current placeholder value in case it changes via another script
                                elem.setAttribute(ATTR_CURRENT_VAL, placeholder);
                            }
                        }
                    } else if (elem.getAttribute(ATTR_ACTIVE)) {
                        hidePlaceholder(elem);
                        elem.removeAttribute(ATTR_CURRENT_VAL);
                    }
                }

                // If live updates are not enabled cancel the timer
                if (!liveUpdates) {
                    clearInterval(timer);
                }
            }, 100);
        }

        Utils.addEventListener(global, 'beforeunload', function () {
            Placeholders.disable();
        });

        // Expose public methods
        Placeholders.disable = Placeholders.nativeSupport ? noop : disablePlaceholders;
        Placeholders.enable = Placeholders.nativeSupport ? noop : enablePlaceholders;

    }(global));
});
// http://www.nczonline.net/blog/2013/01/15/fixing-skip-to-content-links/
/*jshint unused: false */
define('polyfills/hashchange-focus-fix',[], function () {
    
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


//Adjust for going from portrait view to horisontal view without loosing the size of the window
// By @mathias, @cheeaun and @jdalton
define('polyfills/ipad-orientation-fix',[], function () {
    
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
define('polyfills/main',[
    './log',
    './placeholders',
    './hashchange-focus-fix',
    './ipad-orientation-fix'
//    './matchMedia' /* Not sure we need to polyfill this */
], function () {
    
    return {};
});

define('polyfills', ['polyfills/main'], function (main) { return main; });

/*jshint unused: false */
define('core/main',[
    'polyfills',
], function ($) {
    
    return {};
});

define('core', ['core/main'], function (main) { return main; });

/*!
 * typeahead.js 0.10.2
 * https://github.com/twitter/typeahead.js
 * Copyright 2013-2014 Twitter, Inc. and other contributors; Licensed MIT
 */
define('autocomplete/typeahead',[
    'jquery'
], function ($) {

    (function() {
        var _ = {
            isMsie: function() {
                return /(msie|trident)/i.test(navigator.userAgent) ? navigator.userAgent.match(/(msie |rv:)(\d+(.\d+)?)/i)[2] : false;
            },
            isBlankString: function(str) {
                return !str || /^\s*$/.test(str);
            },
            escapeRegExChars: function(str) {
                return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            },
            isString: function(obj) {
                return typeof obj === "string";
            },
            isNumber: function(obj) {
                return typeof obj === "number";
            },
            isArray: $.isArray,
            isFunction: $.isFunction,
            isObject: $.isPlainObject,
            isUndefined: function(obj) {
                return typeof obj === "undefined";
            },
            bind: $.proxy,
            each: function(collection, cb) {
                $.each(collection, reverseArgs);
                function reverseArgs(index, value) {
                    return cb(value, index);
                }
            },
            map: $.map,
            filter: $.grep,
            every: function(obj, test) {
                var result = true;
                if (!obj) {
                    return result;
                }
                $.each(obj, function(key, val) {
                    if (!(result = test.call(null, val, key, obj))) {
                        return false;
                    }
                });
                return !!result;
            },
            some: function(obj, test) {
                var result = false;
                if (!obj) {
                    return result;
                }
                $.each(obj, function(key, val) {
                    if (result = test.call(null, val, key, obj)) {
                        return false;
                    }
                });
                return !!result;
            },
            mixin: $.extend,
            getUniqueId: function() {
                var counter = 0;
                return function() {
                    return counter++;
                };
            }(),
            templatify: function templatify(obj) {
                return $.isFunction(obj) ? obj : template;
                function template() {
                    return String(obj);
                }
            },
            defer: function(fn) {
                setTimeout(fn, 0);
            },
            debounce: function(func, wait, immediate) {
                var timeout, result;
                return function() {
                    var context = this, args = arguments, later, callNow;
                    later = function() {
                        timeout = null;
                        if (!immediate) {
                            result = func.apply(context, args);
                        }
                    };
                    callNow = immediate && !timeout;
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                    if (callNow) {
                        result = func.apply(context, args);
                    }
                    return result;
                };
            },
            throttle: function(func, wait) {
                var context, args, timeout, result, previous, later;
                previous = 0;
                later = function() {
                    previous = new Date();
                    timeout = null;
                    result = func.apply(context, args);
                };
                return function() {
                    var now = new Date(), remaining = wait - (now - previous);
                    context = this;
                    args = arguments;
                    if (remaining <= 0) {
                        clearTimeout(timeout);
                        timeout = null;
                        previous = now;
                        result = func.apply(context, args);
                    } else if (!timeout) {
                        timeout = setTimeout(later, remaining);
                    }
                    return result;
                };
            },
            noop: function() {}
        };
        var VERSION = "0.10.2";
        var tokenizers = function(root) {
            return {
                nonword: nonword,
                whitespace: whitespace,
                obj: {
                    nonword: getObjTokenizer(nonword),
                    whitespace: getObjTokenizer(whitespace)
                }
            };
            function whitespace(s) {
                return s.split(/\s+/);
            }
            function nonword(s) {
                return s.split(/\W+/);
            }
            function getObjTokenizer(tokenizer) {
                return function setKey(key) {
                    return function tokenize(o) {
                        return tokenizer(o[key]);
                    };
                };
            }
        }();
        var LruCache = function() {
            function LruCache(maxSize) {
                this.maxSize = maxSize || 100;
                this.size = 0;
                this.hash = {};
                this.list = new List();
            }
            _.mixin(LruCache.prototype, {
                set: function set(key, val) {
                    var tailItem = this.list.tail, node;
                    if (this.size >= this.maxSize) {
                        this.list.remove(tailItem);
                        delete this.hash[tailItem.key];
                    }
                    if (node = this.hash[key]) {
                        node.val = val;
                        this.list.moveToFront(node);
                    } else {
                        node = new Node(key, val);
                        this.list.add(node);
                        this.hash[key] = node;
                        this.size++;
                    }
                },
                get: function get(key) {
                    var node = this.hash[key];
                    if (node) {
                        this.list.moveToFront(node);
                        return node.val;
                    }
                }
            });
            function List() {
                this.head = this.tail = null;
            }
            _.mixin(List.prototype, {
                add: function add(node) {
                    if (this.head) {
                        node.next = this.head;
                        this.head.prev = node;
                    }
                    this.head = node;
                    this.tail = this.tail || node;
                },
                remove: function remove(node) {
                    node.prev ? node.prev.next = node.next : this.head = node.next;
                    node.next ? node.next.prev = node.prev : this.tail = node.prev;
                },
                moveToFront: function(node) {
                    this.remove(node);
                    this.add(node);
                }
            });
            function Node(key, val) {
                this.key = key;
                this.val = val;
                this.prev = this.next = null;
            }
            return LruCache;
        }();
        var PersistentStorage = function() {
            var ls, methods;
            try {
                ls = window.localStorage;
                ls.setItem("~~~", "!");
                ls.removeItem("~~~");
            } catch (err) {
                ls = null;
            }
            function PersistentStorage(namespace) {
                this.prefix = [ "__", namespace, "__" ].join("");
                this.ttlKey = "__ttl__";
                this.keyMatcher = new RegExp("^" + this.prefix);
            }
            if (ls && window.JSON) {
                methods = {
                    _prefix: function(key) {
                        return this.prefix + key;
                    },
                    _ttlKey: function(key) {
                        return this._prefix(key) + this.ttlKey;
                    },
                    get: function(key) {
                        if (this.isExpired(key)) {
                            this.remove(key);
                        }
                        return decode(ls.getItem(this._prefix(key)));
                    },
                    set: function(key, val, ttl) {
                        if (_.isNumber(ttl)) {
                            ls.setItem(this._ttlKey(key), encode(now() + ttl));
                        } else {
                            ls.removeItem(this._ttlKey(key));
                        }
                        return ls.setItem(this._prefix(key), encode(val));
                    },
                    remove: function(key) {
                        ls.removeItem(this._ttlKey(key));
                        ls.removeItem(this._prefix(key));
                        return this;
                    },
                    clear: function() {
                        var i, key, keys = [], len = ls.length;
                        for (i = 0; i < len; i++) {
                            if ((key = ls.key(i)).match(this.keyMatcher)) {
                                keys.push(key.replace(this.keyMatcher, ""));
                            }
                        }
                        for (i = keys.length; i--; ) {
                            this.remove(keys[i]);
                        }
                        return this;
                    },
                    isExpired: function(key) {
                        var ttl = decode(ls.getItem(this._ttlKey(key)));
                        return _.isNumber(ttl) && now() > ttl ? true : false;
                    }
                };
            } else {
                methods = {
                    get: _.noop,
                    set: _.noop,
                    remove: _.noop,
                    clear: _.noop,
                    isExpired: _.noop
                };
            }
            _.mixin(PersistentStorage.prototype, methods);
            return PersistentStorage;
            function now() {
                return new Date().getTime();
            }
            function encode(val) {
                return JSON.stringify(_.isUndefined(val) ? null : val);
            }
            function decode(val) {
                return JSON.parse(val);
            }
        }();
        var Transport = function() {
            var pendingRequestsCount = 0, pendingRequests = {}, maxPendingRequests = 6, requestCache = new LruCache(10);
            function Transport(o) {
                o = o || {};
                this._send = o.transport ? callbackToDeferred(o.transport) : $.ajax;
                this._get = o.rateLimiter ? o.rateLimiter(this._get) : this._get;
            }
            Transport.setMaxPendingRequests = function setMaxPendingRequests(num) {
                maxPendingRequests = num;
            };
            Transport.resetCache = function clearCache() {
                requestCache = new LruCache(10);
            };
            _.mixin(Transport.prototype, {
                _get: function(url, o, cb) {
                    var that = this, jqXhr;
                    if (jqXhr = pendingRequests[url]) {
                        jqXhr.done(done).fail(fail);
                    } else if (pendingRequestsCount < maxPendingRequests) {
                        pendingRequestsCount++;
                        pendingRequests[url] = this._send(url, o).done(done).fail(fail).always(always);
                    } else {
                        this.onDeckRequestArgs = [].slice.call(arguments, 0);
                    }
                    function done(resp) {
                        cb && cb(null, resp);
                        requestCache.set(url, resp);
                    }
                    function fail() {
                        cb && cb(true);
                    }
                    function always() {
                        pendingRequestsCount--;
                        delete pendingRequests[url];
                        if (that.onDeckRequestArgs) {
                            that._get.apply(that, that.onDeckRequestArgs);
                            that.onDeckRequestArgs = null;
                        }
                    }
                },
                get: function(url, o, cb) {
                    var resp;
                    if (_.isFunction(o)) {
                        cb = o;
                        o = {};
                    }
                    if (resp = requestCache.get(url)) {
                        _.defer(function() {
                            cb && cb(null, resp);
                        });
                    } else {
                        this._get(url, o, cb);
                    }
                    return !!resp;
                }
            });
            return Transport;
            function callbackToDeferred(fn) {
                return function customSendWrapper(url, o) {
                    var deferred = $.Deferred();
                    fn(url, o, onSuccess, onError);
                    return deferred;
                    function onSuccess(resp) {
                        _.defer(function() {
                            deferred.resolve(resp);
                        });
                    }
                    function onError(err) {
                        _.defer(function() {
                            deferred.reject(err);
                        });
                    }
                };
            }
        }();
        var SearchIndex = function() {
            function SearchIndex(o) {
                o = o || {};
                if (!o.datumTokenizer || !o.queryTokenizer) {
                    $.error("datumTokenizer and queryTokenizer are both required");
                }
                this.datumTokenizer = o.datumTokenizer;
                this.queryTokenizer = o.queryTokenizer;
                this.reset();
            }
            _.mixin(SearchIndex.prototype, {
                bootstrap: function bootstrap(o) {
                    this.datums = o.datums;
                    this.trie = o.trie;
                },
                add: function(data) {
                    var that = this;
                    data = _.isArray(data) ? data : [ data ];
                    _.each(data, function(datum) {
                        var id, tokens;
                        id = that.datums.push(datum) - 1;
                        tokens = normalizeTokens(that.datumTokenizer(datum));
                        _.each(tokens, function(token) {
                            var node, chars, ch;
                            node = that.trie;
                            chars = token.split("");
                            while (ch = chars.shift()) {
                                node = node.children[ch] || (node.children[ch] = newNode());
                                node.ids.push(id);
                            }
                        });
                    });
                },
                get: function get(query) {
                    var that = this, tokens, matches;
                    tokens = normalizeTokens(this.queryTokenizer(query));
                    _.each(tokens, function(token) {
                        var node, chars, ch, ids;
                        if (matches && matches.length === 0) {
                            return false;
                        }
                        node = that.trie;
                        chars = token.split("");
                        while (node && (ch = chars.shift())) {
                            node = node.children[ch];
                        }
                        if (node && chars.length === 0) {
                            ids = node.ids.slice(0);
                            matches = matches ? getIntersection(matches, ids) : ids;
                        } else {
                            matches = [];
                            return false;
                        }
                    });
                    return matches ? _.map(unique(matches), function(id) {
                        return that.datums[id];
                    }) : [];
                },
                reset: function reset() {
                    this.datums = [];
                    this.trie = newNode();
                },
                serialize: function serialize() {
                    return {
                        datums: this.datums,
                        trie: this.trie
                    };
                }
            });
            return SearchIndex;
            function normalizeTokens(tokens) {
                tokens = _.filter(tokens, function(token) {
                    return !!token;
                });
                tokens = _.map(tokens, function(token) {
                    return token.toLowerCase();
                });
                return tokens;
            }
            function newNode() {
                return {
                    ids: [],
                    children: {}
                };
            }
            function unique(array) {
                var seen = {}, uniques = [];
                for (var i = 0; i < array.length; i++) {
                    if (!seen[array[i]]) {
                        seen[array[i]] = true;
                        uniques.push(array[i]);
                    }
                }
                return uniques;
            }
            function getIntersection(arrayA, arrayB) {
                var ai = 0, bi = 0, intersection = [];
                arrayA = arrayA.sort(compare);
                arrayB = arrayB.sort(compare);
                while (ai < arrayA.length && bi < arrayB.length) {
                    if (arrayA[ai] < arrayB[bi]) {
                        ai++;
                    } else if (arrayA[ai] > arrayB[bi]) {
                        bi++;
                    } else {
                        intersection.push(arrayA[ai]);
                        ai++;
                        bi++;
                    }
                }
                return intersection;
                function compare(a, b) {
                    return a - b;
                }
            }
        }();
        var oParser = function() {
            return {
                local: getLocal,
                prefetch: getPrefetch,
                remote: getRemote
            };
            function getLocal(o) {
                return o.local || null;
            }
            function getPrefetch(o) {
                var prefetch, defaults;
                defaults = {
                    url: null,
                    thumbprint: "",
                    ttl: 24 * 60 * 60 * 1e3,
                    filter: null,
                    ajax: {}
                };
                if (prefetch = o.prefetch || null) {
                    prefetch = _.isString(prefetch) ? {
                        url: prefetch
                    } : prefetch;
                    prefetch = _.mixin(defaults, prefetch);
                    prefetch.thumbprint = VERSION + prefetch.thumbprint;
                    prefetch.ajax.type = prefetch.ajax.type || "GET";
                    prefetch.ajax.dataType = prefetch.ajax.dataType || "json";
                    !prefetch.url && $.error("prefetch requires url to be set");
                }
                return prefetch;
            }
            function getRemote(o) {
                var remote, defaults;
                defaults = {
                    url: null,
                    wildcard: "%QUERY",
                    replace: null,
                    rateLimitBy: "debounce",
                    rateLimitWait: 300,
                    send: null,
                    filter: null,
                    ajax: {}
                };
                if (remote = o.remote || null) {
                    remote = _.isString(remote) ? {
                        url: remote
                    } : remote;
                    remote = _.mixin(defaults, remote);
                    remote.rateLimiter = /^throttle$/i.test(remote.rateLimitBy) ? byThrottle(remote.rateLimitWait) : byDebounce(remote.rateLimitWait);
                    remote.ajax.type = remote.ajax.type || "GET";
                    remote.ajax.dataType = remote.ajax.dataType || "json";
                    delete remote.rateLimitBy;
                    delete remote.rateLimitWait;
                    !remote.url && $.error("remote requires url to be set");
                }
                return remote;
                function byDebounce(wait) {
                    return function(fn) {
                        return _.debounce(fn, wait);
                    };
                }
                function byThrottle(wait) {
                    return function(fn) {
                        return _.throttle(fn, wait);
                    };
                }
            }
        }();
        (function(root) {
            var old, keys;
            old = root.Bloodhound;
            keys = {
                data: "data",
                protocol: "protocol",
                thumbprint: "thumbprint"
            };
            root.Bloodhound = Bloodhound;
            function Bloodhound(o) {
                if (!o || !o.local && !o.prefetch && !o.remote) {
                    $.error("one of local, prefetch, or remote is required");
                }
                this.limit = o.limit || 5;
                this.sorter = getSorter(o.sorter);
                this.dupDetector = o.dupDetector || ignoreDuplicates;
                this.local = oParser.local(o);
                this.prefetch = oParser.prefetch(o);
                this.remote = oParser.remote(o);
                this.cacheKey = this.prefetch ? this.prefetch.cacheKey || this.prefetch.url : null;
                this.index = new SearchIndex({
                    datumTokenizer: o.datumTokenizer,
                    queryTokenizer: o.queryTokenizer
                });
                this.storage = this.cacheKey ? new PersistentStorage(this.cacheKey) : null;
            }
            Bloodhound.noConflict = function noConflict() {
                root.Bloodhound = old;
                return Bloodhound;
            };
            Bloodhound.tokenizers = tokenizers;
            _.mixin(Bloodhound.prototype, {
                _loadPrefetch: function loadPrefetch(o) {
                    var that = this, serialized, deferred;
                    if (serialized = this._readFromStorage(o.thumbprint)) {
                        this.index.bootstrap(serialized);
                        deferred = $.Deferred().resolve();
                    } else {
                        deferred = $.ajax(o.url, o.ajax).done(handlePrefetchResponse);
                    }
                    return deferred;
                    function handlePrefetchResponse(resp) {
                        that.clear();
                        that.add(o.filter ? o.filter(resp) : resp);
                        that._saveToStorage(that.index.serialize(), o.thumbprint, o.ttl);
                    }
                },
                _getFromRemote: function getFromRemote(query, cb) {
                    var that = this, url, uriEncodedQuery;
                    query = query || "";
                    uriEncodedQuery = encodeURIComponent(query);
                    url = this.remote.replace ? this.remote.replace(this.remote.url, query) : this.remote.url.replace(this.remote.wildcard, uriEncodedQuery);
                    return this.transport.get(url, this.remote.ajax, handleRemoteResponse);
                    function handleRemoteResponse(err, resp) {
                        err ? cb([]) : cb(that.remote.filter ? that.remote.filter(resp) : resp);
                    }
                },
                _saveToStorage: function saveToStorage(data, thumbprint, ttl) {
                    if (this.storage) {
                        this.storage.set(keys.data, data, ttl);
                        this.storage.set(keys.protocol, location.protocol, ttl);
                        this.storage.set(keys.thumbprint, thumbprint, ttl);
                    }
                },
                _readFromStorage: function readFromStorage(thumbprint) {
                    var stored = {}, isExpired;
                    if (this.storage) {
                        stored.data = this.storage.get(keys.data);
                        stored.protocol = this.storage.get(keys.protocol);
                        stored.thumbprint = this.storage.get(keys.thumbprint);
                    }
                    isExpired = stored.thumbprint !== thumbprint || stored.protocol !== location.protocol;
                    return stored.data && !isExpired ? stored.data : null;
                },
                _initialize: function initialize() {
                    var that = this, local = this.local, deferred;
                    deferred = this.prefetch ? this._loadPrefetch(this.prefetch) : $.Deferred().resolve();
                    local && deferred.done(addLocalToIndex);
                    this.transport = this.remote ? new Transport(this.remote) : null;
                    return this.initPromise = deferred.promise();
                    function addLocalToIndex() {
                        that.add(_.isFunction(local) ? local() : local);
                    }
                },
                initialize: function initialize(force) {
                    return !this.initPromise || force ? this._initialize() : this.initPromise;
                },
                add: function add(data) {
                    this.index.add(data);
                },
                get: function get(query, cb) {
                    var that = this, matches = [], cacheHit = false;
                    matches = this.index.get(query);
                    matches = this.sorter(matches).slice(0, this.limit);
                    if (matches.length < this.limit && this.transport) {
                        cacheHit = this._getFromRemote(query, returnRemoteMatches);
                    }
                    if (!cacheHit) {
                        (matches.length > 0 || !this.transport) && cb && cb(matches);
                    }
                    function returnRemoteMatches(remoteMatches) {
                        var matchesWithBackfill = matches.slice(0);
                        _.each(remoteMatches, function(remoteMatch) {
                            var isDuplicate;
                            isDuplicate = _.some(matchesWithBackfill, function(match) {
                                return that.dupDetector(remoteMatch, match);
                            });
                            !isDuplicate && matchesWithBackfill.push(remoteMatch);
                            return matchesWithBackfill.length < that.limit;
                        });
                        cb && cb(that.sorter(matchesWithBackfill));
                    }
                },
                clear: function clear() {
                    this.index.reset();
                },
                clearPrefetchCache: function clearPrefetchCache() {
                    this.storage && this.storage.clear();
                },
                clearRemoteCache: function clearRemoteCache() {
                    this.transport && Transport.resetCache();
                },
                ttAdapter: function ttAdapter() {
                    return _.bind(this.get, this);
                }
            });
            return Bloodhound;
            function getSorter(sortFn) {
                return _.isFunction(sortFn) ? sort : noSort;
                function sort(array) {
                    return array.sort(sortFn);
                }
                function noSort(array) {
                    return array;
                }
            }
            function ignoreDuplicates() {
                return false;
            }
        })(this);
        var html = {
            wrapper: '<span class="twitter-typeahead"></span>',
            dropdown: '<span class="tt-dropdown-menu"></span>',
            dataset: '<div class="tt-dataset-%CLASS%"></div>',
            suggestions: '<span class="tt-suggestions"></span>',
            suggestion: '<div class="tt-suggestion"></div>'
        };
        var css = {
            wrapper: {
                position: "relative",
                display: "inline-block"
            },
            hint: {
                position: "absolute",
                top: "0",
                left: "0",
                borderColor: "transparent",
                boxShadow: "none"
            },
            input: {
                position: "relative",
                verticalAlign: "top",
                backgroundColor: "transparent"
            },
            inputWithNoHint: {
                position: "relative",
                verticalAlign: "top"
            },
            dropdown: {
                position: "absolute",
                top: "100%",
                left: "0",
                zIndex: "100",
                display: "none"
            },
            suggestions: {
                display: "block"
            },
            suggestion: {
                whiteSpace: "nowrap",
                cursor: "pointer"
            },
            suggestionChild: {
                whiteSpace: "normal"
            },
            ltr: {
                left: "0",
                right: "auto"
            },
            rtl: {
                left: "auto",
                right: " 0"
            }
        };
        if (_.isMsie()) {
            _.mixin(css.input, {
                backgroundImage: "url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)"
            });
        }
        if (_.isMsie() && _.isMsie() <= 7) {
            _.mixin(css.input, {
                marginTop: "-1px"
            });
        }
        var EventBus = function() {
            var namespace = "typeahead:";
            function EventBus(o) {
                if (!o || !o.el) {
                    $.error("EventBus initialized without el");
                }
                this.$el = $(o.el);
            }
            _.mixin(EventBus.prototype, {
                trigger: function(type) {
                    var args = [].slice.call(arguments, 1);
                    this.$el.trigger(namespace + type, args);
                }
            });
            return EventBus;
        }();
        var EventEmitter = function() {
            var splitter = /\s+/, nextTick = getNextTick();
            return {
                onSync: onSync,
                onAsync: onAsync,
                off: off,
                trigger: trigger
            };
            function on(method, types, cb, context) {
                var type;
                if (!cb) {
                    return this;
                }
                types = types.split(splitter);
                cb = context ? bindContext(cb, context) : cb;
                this._callbacks = this._callbacks || {};
                while (type = types.shift()) {
                    this._callbacks[type] = this._callbacks[type] || {
                        sync: [],
                        async: []
                    };
                    this._callbacks[type][method].push(cb);
                }
                return this;
            }
            function onAsync(types, cb, context) {
                return on.call(this, "async", types, cb, context);
            }
            function onSync(types, cb, context) {
                return on.call(this, "sync", types, cb, context);
            }
            function off(types) {
                var type;
                if (!this._callbacks) {
                    return this;
                }
                types = types.split(splitter);
                while (type = types.shift()) {
                    delete this._callbacks[type];
                }
                return this;
            }
            function trigger(types) {
                var type, callbacks, args, syncFlush, asyncFlush;
                if (!this._callbacks) {
                    return this;
                }
                types = types.split(splitter);
                args = [].slice.call(arguments, 1);
                while ((type = types.shift()) && (callbacks = this._callbacks[type])) {
                    syncFlush = getFlush(callbacks.sync, this, [ type ].concat(args));
                    asyncFlush = getFlush(callbacks.async, this, [ type ].concat(args));
                    syncFlush() && nextTick(asyncFlush);
                }
                return this;
            }
            function getFlush(callbacks, context, args) {
                return flush;
                function flush() {
                    var cancelled;
                    for (var i = 0; !cancelled && i < callbacks.length; i += 1) {
                        cancelled = callbacks[i].apply(context, args) === false;
                    }
                    return !cancelled;
                }
            }
            function getNextTick() {
                var nextTickFn;
                if (window.setImmediate) {
                    nextTickFn = function nextTickSetImmediate(fn) {
                        setImmediate(function() {
                            fn();
                        });
                    };
                } else {
                    nextTickFn = function nextTickSetTimeout(fn) {
                        setTimeout(function() {
                            fn();
                        }, 0);
                    };
                }
                return nextTickFn;
            }
            function bindContext(fn, context) {
                return fn.bind ? fn.bind(context) : function() {
                    fn.apply(context, [].slice.call(arguments, 0));
                };
            }
        }();
        var highlight = function(doc) {
            var defaults = {
                node: null,
                pattern: null,
                tagName: "strong",
                className: null,
                wordsOnly: false,
                caseSensitive: false
            };
            return function hightlight(o) {
                var regex;
                o = _.mixin({}, defaults, o);
                if (!o.node || !o.pattern) {
                    return;
                }
                o.pattern = _.isArray(o.pattern) ? o.pattern : [ o.pattern ];
                regex = getRegex(o.pattern, o.caseSensitive, o.wordsOnly);
                traverse(o.node, hightlightTextNode);
                function hightlightTextNode(textNode) {
                    var match, patternNode;
                    if (match = regex.exec(textNode.data)) {
                        wrapperNode = doc.createElement(o.tagName);
                        o.className && (wrapperNode.className = o.className);
                        patternNode = textNode.splitText(match.index);
                        patternNode.splitText(match[0].length);
                        wrapperNode.appendChild(patternNode.cloneNode(true));
                        textNode.parentNode.replaceChild(wrapperNode, patternNode);
                    }
                    return !!match;
                }
                function traverse(el, hightlightTextNode) {
                    var childNode, TEXT_NODE_TYPE = 3;
                    for (var i = 0; i < el.childNodes.length; i++) {
                        childNode = el.childNodes[i];
                        if (childNode.nodeType === TEXT_NODE_TYPE) {
                            i += hightlightTextNode(childNode) ? 1 : 0;
                        } else {
                            traverse(childNode, hightlightTextNode);
                        }
                    }
                }
            };
            function getRegex(patterns, caseSensitive, wordsOnly) {
                var escapedPatterns = [], regexStr;
                for (var i = 0; i < patterns.length; i++) {
                    escapedPatterns.push(_.escapeRegExChars(patterns[i]));
                }
                regexStr = wordsOnly ? "\\b(" + escapedPatterns.join("|") + ")\\b" : "(" + escapedPatterns.join("|") + ")";
                return caseSensitive ? new RegExp(regexStr) : new RegExp(regexStr, "i");
            }
        }(window.document);
        var Input = function() {
            var specialKeyCodeMap;
            specialKeyCodeMap = {
                9: "tab",
                27: "esc",
                37: "left",
                39: "right",
                13: "enter",
                38: "up",
                40: "down"
            };
            function Input(o) {
                var that = this, onBlur, onFocus, onKeydown, onInput;
                o = o || {};
                if (!o.input) {
                    $.error("input is missing");
                }
                onBlur = _.bind(this._onBlur, this);
                onFocus = _.bind(this._onFocus, this);
                onKeydown = _.bind(this._onKeydown, this);
                onInput = _.bind(this._onInput, this);
                this.$hint = $(o.hint);
                this.$input = $(o.input).on("blur.tt", onBlur).on("focus.tt", onFocus).on("keydown.tt", onKeydown);
                if (this.$hint.length === 0) {
                    this.setHint = this.getHint = this.clearHint = this.clearHintIfInvalid = _.noop;
                }
                if (!_.isMsie()) {
                    this.$input.on("input.tt", onInput);
                } else {
                    this.$input.on("keydown.tt keypress.tt cut.tt paste.tt", function($e) {
                        if (specialKeyCodeMap[$e.which || $e.keyCode]) {
                            return;
                        }
                        _.defer(_.bind(that._onInput, that, $e));
                    });
                }
                this.query = this.$input.val();
                this.$overflowHelper = buildOverflowHelper(this.$input);
            }
            Input.normalizeQuery = function(str) {
                return (str || "").replace(/^\s*/g, "").replace(/\s{2,}/g, " ");
            };
            _.mixin(Input.prototype, EventEmitter, {
                _onBlur: function onBlur() {
                    this.resetInputValue();
                    this.trigger("blurred");
                },
                _onFocus: function onFocus() {
                    this.trigger("focused");
                },
                _onKeydown: function onKeydown($e) {
                    var keyName = specialKeyCodeMap[$e.which || $e.keyCode];
                    this._managePreventDefault(keyName, $e);
                    if (keyName && this._shouldTrigger(keyName, $e)) {
                        this.trigger(keyName + "Keyed", $e);
                    }
                },
                _onInput: function onInput() {
                    this._checkInputValue();
                },
                _managePreventDefault: function managePreventDefault(keyName, $e) {
                    var preventDefault, hintValue, inputValue;
                    switch (keyName) {
                      case "tab":
                        hintValue = this.getHint();
                        inputValue = this.getInputValue();
                        preventDefault = hintValue && hintValue !== inputValue && !withModifier($e);
                        break;

                      case "up":
                      case "down":
                        preventDefault = !withModifier($e);
                        break;

                      default:
                        preventDefault = false;
                    }
                    preventDefault && $e.preventDefault();
                },
                _shouldTrigger: function shouldTrigger(keyName, $e) {
                    var trigger;
                    switch (keyName) {
                      case "tab":
                        trigger = !withModifier($e);
                        break;

                      default:
                        trigger = true;
                    }
                    return trigger;
                },
                _checkInputValue: function checkInputValue() {
                    var inputValue, areEquivalent, hasDifferentWhitespace;
                    inputValue = this.getInputValue();
                    areEquivalent = areQueriesEquivalent(inputValue, this.query);
                    hasDifferentWhitespace = areEquivalent ? this.query.length !== inputValue.length : false;
                    if (!areEquivalent) {
                        this.trigger("queryChanged", this.query = inputValue);
                    } else if (hasDifferentWhitespace) {
                        this.trigger("whitespaceChanged", this.query);
                    }
                },
                focus: function focus() {
                    this.$input.focus();
                },
                blur: function blur() {
                    this.$input.blur();
                },
                getQuery: function getQuery() {
                    return this.query;
                },
                setQuery: function setQuery(query) {
                    this.query = query;
                },
                getInputValue: function getInputValue() {
                    return this.$input.val();
                },
                setInputValue: function setInputValue(value, silent) {
                    this.$input.val(value);
                    silent ? this.clearHint() : this._checkInputValue();
                },
                resetInputValue: function resetInputValue() {
                    this.setInputValue(this.query, true);
                },
                getHint: function getHint() {
                    return this.$hint.val();
                },
                setHint: function setHint(value) {
                    this.$hint.val(value);
                },
                clearHint: function clearHint() {
                    this.setHint("");
                },
                clearHintIfInvalid: function clearHintIfInvalid() {
                    var val, hint, valIsPrefixOfHint, isValid;
                    val = this.getInputValue();
                    hint = this.getHint();
                    valIsPrefixOfHint = val !== hint && hint.indexOf(val) === 0;
                    isValid = val !== "" && valIsPrefixOfHint && !this.hasOverflow();
                    !isValid && this.clearHint();
                },
                getLanguageDirection: function getLanguageDirection() {
                    return (this.$input.css("direction") || "ltr").toLowerCase();
                },
                hasOverflow: function hasOverflow() {
                    var constraint = this.$input.width() - 2;
                    this.$overflowHelper.text(this.getInputValue());
                    return this.$overflowHelper.width() >= constraint;
                },
                isCursorAtEnd: function() {
                    var valueLength, selectionStart, range;
                    valueLength = this.$input.val().length;
                    selectionStart = this.$input[0].selectionStart;
                    if (_.isNumber(selectionStart)) {
                        return selectionStart === valueLength;
                    } else if (document.selection) {
                        range = document.selection.createRange();
                        range.moveStart("character", -valueLength);
                        return valueLength === range.text.length;
                    }
                    return true;
                },
                destroy: function destroy() {
                    this.$hint.off(".tt");
                    this.$input.off(".tt");
                    this.$hint = this.$input = this.$overflowHelper = null;
                }
            });
            return Input;
            function buildOverflowHelper($input) {
                return $('<pre aria-hidden="true"></pre>').css({
                    position: "absolute",
                    visibility: "hidden",
                    whiteSpace: "pre",
                    fontFamily: $input.css("font-family"),
                    fontSize: $input.css("font-size"),
                    fontStyle: $input.css("font-style"),
                    fontVariant: $input.css("font-variant"),
                    fontWeight: $input.css("font-weight"),
                    wordSpacing: $input.css("word-spacing"),
                    letterSpacing: $input.css("letter-spacing"),
                    textIndent: $input.css("text-indent"),
                    textRendering: $input.css("text-rendering"),
                    textTransform: $input.css("text-transform")
                }).insertAfter($input);
            }
            function areQueriesEquivalent(a, b) {
                return Input.normalizeQuery(a) === Input.normalizeQuery(b);
            }
            function withModifier($e) {
                return $e.altKey || $e.ctrlKey || $e.metaKey || $e.shiftKey;
            }
        }();
        var Dataset = function() {
            var datasetKey = "ttDataset", valueKey = "ttValue", datumKey = "ttDatum";
            function Dataset(o) {
                o = o || {};
                o.templates = o.templates || {};
                if (!o.source) {
                    $.error("missing source");
                }
                if (o.name && !isValidName(o.name)) {
                    $.error("invalid dataset name: " + o.name);
                }
                this.query = null;
                this.highlight = !!o.highlight;
                this.name = o.name || _.getUniqueId();
                this.source = o.source;
                this.displayFn = getDisplayFn(o.display || o.displayKey);
                this.templates = getTemplates(o.templates, this.displayFn);
                this.$el = $(html.dataset.replace("%CLASS%", this.name));
            }
            Dataset.extractDatasetName = function extractDatasetName(el) {
                return $(el).data(datasetKey);
            };
            Dataset.extractValue = function extractDatum(el) {
                return $(el).data(valueKey);
            };
            Dataset.extractDatum = function extractDatum(el) {
                return $(el).data(datumKey);
            };
            _.mixin(Dataset.prototype, EventEmitter, {
                _render: function render(query, suggestions) {
                    if (!this.$el) {
                        return;
                    }
                    var that = this, hasSuggestions;
                    this.$el.empty();
                    hasSuggestions = suggestions && suggestions.length;
                    if (!hasSuggestions && this.templates.empty) {
                        this.$el.html(getEmptyHtml()).prepend(that.templates.header ? getHeaderHtml() : null).append(that.templates.footer ? getFooterHtml() : null);
                    } else if (hasSuggestions) {
                        this.$el.html(getSuggestionsHtml()).prepend(that.templates.header ? getHeaderHtml() : null).append(that.templates.footer ? getFooterHtml() : null);
                    }
                    this.trigger("rendered");
                    function getEmptyHtml() {
                        return that.templates.empty({
                            query: query,
                            isEmpty: true
                        });
                    }
                    function getSuggestionsHtml() {
                        var $suggestions, nodes;
                        $suggestions = $(html.suggestions).css(css.suggestions);
                        nodes = _.map(suggestions, getSuggestionNode);
                        $suggestions.append.apply($suggestions, nodes);
                        that.highlight && highlight({
                            node: $suggestions[0],
                            pattern: query
                        });
                        return $suggestions;
                        function getSuggestionNode(suggestion) {
                            var $el;
                            $el = $(html.suggestion).append(that.templates.suggestion(suggestion)).data(datasetKey, that.name).data(valueKey, that.displayFn(suggestion)).data(datumKey, suggestion);
                            $el.children().each(function() {
                                $(this).css(css.suggestionChild);
                            });
                            return $el;
                        }
                    }
                    function getHeaderHtml() {
                        return that.templates.header({
                            query: query,
                            isEmpty: !hasSuggestions
                        });
                    }
                    function getFooterHtml() {
                        return that.templates.footer({
                            query: query,
                            isEmpty: !hasSuggestions
                        });
                    }
                },
                getRoot: function getRoot() {
                    return this.$el;
                },
                update: function update(query) {
                    var that = this;
                    this.query = query;
                    this.canceled = false;
                    this.source(query, render);
                    function render(suggestions) {
                        if (!that.canceled && query === that.query) {
                            that._render(query, suggestions);
                        }
                    }
                },
                cancel: function cancel() {
                    this.canceled = true;
                },
                clear: function clear() {
                    this.cancel();
                    this.$el.empty();
                    this.trigger("rendered");
                },
                isEmpty: function isEmpty() {
                    return this.$el.is(":empty");
                },
                destroy: function destroy() {
                    this.$el = null;
                }
            });
            return Dataset;
            function getDisplayFn(display) {
                display = display || "value";
                return _.isFunction(display) ? display : displayFn;
                function displayFn(obj) {
                    return obj[display];
                }
            }
            function getTemplates(templates, displayFn) {
                return {
                    empty: templates.empty && _.templatify(templates.empty),
                    header: templates.header && _.templatify(templates.header),
                    footer: templates.footer && _.templatify(templates.footer),
                    suggestion: templates.suggestion || suggestionTemplate
                };
                function suggestionTemplate(context) {
                    return "<p>" + displayFn(context) + "</p>";
                }
            }
            function isValidName(str) {
                return /^[_a-zA-Z0-9-]+$/.test(str);
            }
        }();
        var Dropdown = function() {
            function Dropdown(o) {
                var that = this, onSuggestionClick, onSuggestionMouseEnter, onSuggestionMouseLeave;
                o = o || {};
                if (!o.menu) {
                    $.error("menu is required");
                }
                this.isOpen = false;
                this.isEmpty = true;
                this.datasets = _.map(o.datasets, initializeDataset);
                onSuggestionClick = _.bind(this._onSuggestionClick, this);
                onSuggestionMouseEnter = _.bind(this._onSuggestionMouseEnter, this);
                onSuggestionMouseLeave = _.bind(this._onSuggestionMouseLeave, this);
                this.$menu = $(o.menu).on("click.tt", ".tt-suggestion", onSuggestionClick).on("mouseenter.tt", ".tt-suggestion", onSuggestionMouseEnter).on("mouseleave.tt", ".tt-suggestion", onSuggestionMouseLeave);
                _.each(this.datasets, function(dataset) {
                    that.$menu.append(dataset.getRoot());
                    dataset.onSync("rendered", that._onRendered, that);
                });
            }
            _.mixin(Dropdown.prototype, EventEmitter, {
                _onSuggestionClick: function onSuggestionClick($e) {
                    this.trigger("suggestionClicked", $($e.currentTarget));
                },
                _onSuggestionMouseEnter: function onSuggestionMouseEnter($e) {
                    this._removeCursor();
                    this._setCursor($($e.currentTarget), true);
                },
                _onSuggestionMouseLeave: function onSuggestionMouseLeave() {
                    this._removeCursor();
                },
                _onRendered: function onRendered() {
                    this.isEmpty = _.every(this.datasets, isDatasetEmpty);
                    this.isEmpty ? this._hide() : this.isOpen && this._show();
                    this.trigger("datasetRendered");
                    function isDatasetEmpty(dataset) {
                        return dataset.isEmpty();
                    }
                },
                _hide: function() {
                    this.$menu.hide();
                },
                _show: function() {
                    this.$menu.css("display", "block");
                },
                _getSuggestions: function getSuggestions() {
                    return this.$menu.find(".tt-suggestion");
                },
                _getCursor: function getCursor() {
                    return this.$menu.find(".tt-cursor").first();
                },
                _setCursor: function setCursor($el, silent) {
                    $el.first().addClass("tt-cursor");
                    !silent && this.trigger("cursorMoved");
                },
                _removeCursor: function removeCursor() {
                    this._getCursor().removeClass("tt-cursor");
                },
                _moveCursor: function moveCursor(increment) {
                    var $suggestions, $oldCursor, newCursorIndex, $newCursor;
                    if (!this.isOpen) {
                        return;
                    }
                    $oldCursor = this._getCursor();
                    $suggestions = this._getSuggestions();
                    this._removeCursor();
                    newCursorIndex = $suggestions.index($oldCursor) + increment;
                    newCursorIndex = (newCursorIndex + 1) % ($suggestions.length + 1) - 1;
                    if (newCursorIndex === -1) {
                        this.trigger("cursorRemoved");
                        return;
                    } else if (newCursorIndex < -1) {
                        newCursorIndex = $suggestions.length - 1;
                    }
                    this._setCursor($newCursor = $suggestions.eq(newCursorIndex));
                    this._ensureVisible($newCursor);
                },
                _ensureVisible: function ensureVisible($el) {
                    var elTop, elBottom, menuScrollTop, menuHeight;
                    elTop = $el.position().top;
                    elBottom = elTop + $el.outerHeight(true);
                    menuScrollTop = this.$menu.scrollTop();
                    menuHeight = this.$menu.height() + parseInt(this.$menu.css("paddingTop"), 10) + parseInt(this.$menu.css("paddingBottom"), 10);
                    if (elTop < 0) {
                        this.$menu.scrollTop(menuScrollTop + elTop);
                    } else if (menuHeight < elBottom) {
                        this.$menu.scrollTop(menuScrollTop + (elBottom - menuHeight));
                    }
                },
                close: function close() {
                    if (this.isOpen) {
                        this.isOpen = false;
                        this._removeCursor();
                        this._hide();
                        this.trigger("closed");
                    }
                },
                open: function open() {
                    if (!this.isOpen) {
                        this.isOpen = true;
                        !this.isEmpty && this._show();
                        this.trigger("opened");
                    }
                },
                setLanguageDirection: function setLanguageDirection(dir) {
                    this.$menu.css(dir === "ltr" ? css.ltr : css.rtl);
                },
                moveCursorUp: function moveCursorUp() {
                    this._moveCursor(-1);
                },
                moveCursorDown: function moveCursorDown() {
                    this._moveCursor(+1);
                },
                getDatumForSuggestion: function getDatumForSuggestion($el) {
                    var datum = null;
                    if ($el.length) {
                        datum = {
                            raw: Dataset.extractDatum($el),
                            value: Dataset.extractValue($el),
                            datasetName: Dataset.extractDatasetName($el)
                        };
                    }
                    return datum;
                },
                getDatumForCursor: function getDatumForCursor() {
                    return this.getDatumForSuggestion(this._getCursor().first());
                },
                getDatumForTopSuggestion: function getDatumForTopSuggestion() {
                    return this.getDatumForSuggestion(this._getSuggestions().first());
                },
                update: function update(query) {
                    _.each(this.datasets, updateDataset);
                    function updateDataset(dataset) {
                        dataset.update(query);
                    }
                },
                empty: function empty() {
                    _.each(this.datasets, clearDataset);
                    this.isEmpty = true;
                    function clearDataset(dataset) {
                        dataset.clear();
                    }
                },
                isVisible: function isVisible() {
                    return this.isOpen && !this.isEmpty;
                },
                destroy: function destroy() {
                    this.$menu.off(".tt");
                    this.$menu = null;
                    _.each(this.datasets, destroyDataset);
                    function destroyDataset(dataset) {
                        dataset.destroy();
                    }
                }
            });
            return Dropdown;
            function initializeDataset(oDataset) {
                return new Dataset(oDataset);
            }
        }();
        var Typeahead = function() {
            var attrsKey = "ttAttrs";
            function Typeahead(o) {
                var $menu, $input, $hint;
                o = o || {};
                if (!o.input) {
                    $.error("missing input");
                }
                this.isActivated = false;
                this.autoselect = !!o.autoselect;
                this.minLength = _.isNumber(o.minLength) ? o.minLength : 1;
                this.$node = buildDomStructure(o.input, o.withHint);
                $menu = this.$node.find(".tt-dropdown-menu");
                $input = this.$node.find(".tt-input");
                $hint = this.$node.find(".tt-hint");
                $input.on("blur.tt", function($e) {
                    var active, isActive, hasActive;
                    active = document.activeElement;
                    isActive = $menu.is(active);
                    hasActive = $menu.has(active).length > 0;
                    if (_.isMsie() && (isActive || hasActive)) {
                        $e.preventDefault();
                        $e.stopImmediatePropagation();
                        _.defer(function() {
                            $input.focus();
                        });
                    }
                });
                $menu.on("mousedown.tt", function($e) {
                    $e.preventDefault();
                });
                this.eventBus = o.eventBus || new EventBus({
                    el: $input
                });
                this.dropdown = new Dropdown({
                    menu: $menu,
                    datasets: o.datasets
                }).onSync("suggestionClicked", this._onSuggestionClicked, this).onSync("cursorMoved", this._onCursorMoved, this).onSync("cursorRemoved", this._onCursorRemoved, this).onSync("opened", this._onOpened, this).onSync("closed", this._onClosed, this).onAsync("datasetRendered", this._onDatasetRendered, this);
                this.input = new Input({
                    input: $input,
                    hint: $hint
                }).onSync("focused", this._onFocused, this).onSync("blurred", this._onBlurred, this).onSync("enterKeyed", this._onEnterKeyed, this).onSync("tabKeyed", this._onTabKeyed, this).onSync("escKeyed", this._onEscKeyed, this).onSync("upKeyed", this._onUpKeyed, this).onSync("downKeyed", this._onDownKeyed, this).onSync("leftKeyed", this._onLeftKeyed, this).onSync("rightKeyed", this._onRightKeyed, this).onSync("queryChanged", this._onQueryChanged, this).onSync("whitespaceChanged", this._onWhitespaceChanged, this);
                this._setLanguageDirection();
            }
            _.mixin(Typeahead.prototype, {
                _onSuggestionClicked: function onSuggestionClicked(type, $el) {
                    var datum;
                    if (datum = this.dropdown.getDatumForSuggestion($el)) {
                        this._select(datum);
                    }
                },
                _onCursorMoved: function onCursorMoved() {
                    var datum = this.dropdown.getDatumForCursor();
                    this.input.setInputValue(datum.value, true);
                    this.eventBus.trigger("cursorchanged", datum.raw, datum.datasetName);
                },
                _onCursorRemoved: function onCursorRemoved() {
                    this.input.resetInputValue();
                    this._updateHint();
                },
                _onDatasetRendered: function onDatasetRendered() {
                    this._updateHint();
                },
                _onOpened: function onOpened() {
                    this._updateHint();
                    this.eventBus.trigger("opened");
                },
                _onClosed: function onClosed() {
                    this.input.clearHint();
                    this.eventBus.trigger("closed");
                },
                _onFocused: function onFocused() {
                    this.isActivated = true;
                    this.dropdown.open();
                },
                _onBlurred: function onBlurred() {
                    this.isActivated = false;
                    this.dropdown.empty();
                    this.dropdown.close();
                },
                _onEnterKeyed: function onEnterKeyed(type, $e) {
                    var cursorDatum, topSuggestionDatum;
                    cursorDatum = this.dropdown.getDatumForCursor();
                    topSuggestionDatum = this.dropdown.getDatumForTopSuggestion();
                    if (cursorDatum) {
                        this._select(cursorDatum);
                        $e.preventDefault();
                    } else if (this.autoselect && topSuggestionDatum) {
                        this._select(topSuggestionDatum);
                        $e.preventDefault();
                    }
                },
                _onTabKeyed: function onTabKeyed(type, $e) {
                    var datum;
                    if (datum = this.dropdown.getDatumForCursor()) {
                        this._select(datum);
                        $e.preventDefault();
                    } else {
                        this._autocomplete(true);
                    }
                },
                _onEscKeyed: function onEscKeyed() {
                    this.dropdown.close();
                    this.input.resetInputValue();
                },
                _onUpKeyed: function onUpKeyed() {
                    var query = this.input.getQuery();
                    this.dropdown.isEmpty && query.length >= this.minLength ? this.dropdown.update(query) : this.dropdown.moveCursorUp();
                    this.dropdown.open();
                },
                _onDownKeyed: function onDownKeyed() {
                    var query = this.input.getQuery();
                    this.dropdown.isEmpty && query.length >= this.minLength ? this.dropdown.update(query) : this.dropdown.moveCursorDown();
                    this.dropdown.open();
                },
                _onLeftKeyed: function onLeftKeyed() {
                    this.dir === "rtl" && this._autocomplete();
                },
                _onRightKeyed: function onRightKeyed() {
                    this.dir === "ltr" && this._autocomplete();
                },
                _onQueryChanged: function onQueryChanged(e, query) {
                    this.input.clearHintIfInvalid();
                    query.length >= this.minLength ? this.dropdown.update(query) : this.dropdown.empty();
                    this.dropdown.open();
                    this._setLanguageDirection();
                },
                _onWhitespaceChanged: function onWhitespaceChanged() {
                    this._updateHint();
                    this.dropdown.open();
                },
                _setLanguageDirection: function setLanguageDirection() {
                    var dir;
                    if (this.dir !== (dir = this.input.getLanguageDirection())) {
                        this.dir = dir;
                        this.$node.css("direction", dir);
                        this.dropdown.setLanguageDirection(dir);
                    }
                },
                _updateHint: function updateHint() {
                    var datum, val, query, escapedQuery, frontMatchRegEx, match;
                    datum = this.dropdown.getDatumForTopSuggestion();
                    if (datum && this.dropdown.isVisible() && !this.input.hasOverflow()) {
                        val = this.input.getInputValue();
                        query = Input.normalizeQuery(val);
                        escapedQuery = _.escapeRegExChars(query);
                        frontMatchRegEx = new RegExp("^(?:" + escapedQuery + ")(.+$)", "i");
                        match = frontMatchRegEx.exec(datum.value);
                        match ? this.input.setHint(val + match[1]) : this.input.clearHint();
                    } else {
                        this.input.clearHint();
                    }
                },
                _autocomplete: function autocomplete(laxCursor) {
                    var hint, query, isCursorAtEnd, datum;
                    hint = this.input.getHint();
                    query = this.input.getQuery();
                    isCursorAtEnd = laxCursor || this.input.isCursorAtEnd();
                    if (hint && query !== hint && isCursorAtEnd) {
                        datum = this.dropdown.getDatumForTopSuggestion();
                        datum && this.input.setInputValue(datum.value);
                        this.eventBus.trigger("autocompleted", datum.raw, datum.datasetName);
                    }
                },
                _select: function select(datum) {
                    this.input.setQuery(datum.value);
                    this.input.setInputValue(datum.value, true);
                    this._setLanguageDirection();
                    this.eventBus.trigger("selected", datum.raw, datum.datasetName);
                    this.dropdown.close();
                    _.defer(_.bind(this.dropdown.empty, this.dropdown));
                },
                open: function open() {
                    this.dropdown.open();
                },
                close: function close() {
                    this.dropdown.close();
                },
                setVal: function setVal(val) {
                    if (this.isActivated) {
                        this.input.setInputValue(val);
                    } else {
                        this.input.setQuery(val);
                        this.input.setInputValue(val, true);
                    }
                    this._setLanguageDirection();
                },
                getVal: function getVal() {
                    return this.input.getQuery();
                },
                destroy: function destroy() {
                    this.input.destroy();
                    this.dropdown.destroy();
                    destroyDomStructure(this.$node);
                    this.$node = null;
                }
            });
            return Typeahead;
            function buildDomStructure(input, withHint) {
                var $input, $wrapper, $dropdown, $hint;
                $input = $(input);
                $wrapper = $(html.wrapper).css(css.wrapper);
                $dropdown = $(html.dropdown).css(css.dropdown);
                $hint = $input.clone().css(css.hint).css(getBackgroundStyles($input));
                $hint.val("").removeData().addClass("tt-hint").removeAttr("id name placeholder").prop("disabled", true).attr({
                    autocomplete: "off",
                    spellcheck: "false"
                });
                $input.data(attrsKey, {
                    dir: $input.attr("dir"),
                    autocomplete: $input.attr("autocomplete"),
                    spellcheck: $input.attr("spellcheck"),
                    style: $input.attr("style")
                });
                $input.addClass("tt-input").attr({
                    autocomplete: "off",
                    spellcheck: false
                }).css(withHint ? css.input : css.inputWithNoHint);
                try {
                    !$input.attr("dir") && $input.attr("dir", "auto");
                } catch (e) {}
                return $input.wrap($wrapper).parent().prepend(withHint ? $hint : null).append($dropdown);
            }
            function getBackgroundStyles($el) {
                return {
                    backgroundAttachment: $el.css("background-attachment"),
                    backgroundClip: $el.css("background-clip"),
                    backgroundColor: $el.css("background-color"),
                    backgroundImage: $el.css("background-image"),
                    backgroundOrigin: $el.css("background-origin"),
                    backgroundPosition: $el.css("background-position"),
                    backgroundRepeat: $el.css("background-repeat"),
                    backgroundSize: $el.css("background-size")
                };
            }
            function destroyDomStructure($node) {
                var $input = $node.find(".tt-input");
                _.each($input.data(attrsKey), function(val, key) {
                    _.isUndefined(val) ? $input.removeAttr(key) : $input.attr(key, val);
                });
                $input.detach().removeData(attrsKey).removeClass("tt-input").insertAfter($node);
                $node.remove();
            }
        }();
        (function() {
            var old, typeaheadKey, methods;
            old = $.fn.typeahead;
            typeaheadKey = "ttTypeahead";
            methods = {
                initialize: function initialize(o, datasets) {
                    datasets = _.isArray(datasets) ? datasets : [].slice.call(arguments, 1);
                    o = o || {};
                    return this.each(attach);
                    function attach() {
                        var $input = $(this), eventBus, typeahead;
                        _.each(datasets, function(d) {
                            d.highlight = !!o.highlight;
                        });
                        typeahead = new Typeahead({
                            input: $input,
                            eventBus: eventBus = new EventBus({
                                el: $input
                            }),
                            withHint: _.isUndefined(o.hint) ? true : !!o.hint,
                            minLength: o.minLength,
                            autoselect: o.autoselect,
                            datasets: datasets
                        });
                        $input.data(typeaheadKey, typeahead);
                    }
                },
                open: function open() {
                    return this.each(openTypeahead);
                    function openTypeahead() {
                        var $input = $(this), typeahead;
                        if (typeahead = $input.data(typeaheadKey)) {
                            typeahead.open();
                        }
                    }
                },
                close: function close() {
                    return this.each(closeTypeahead);
                    function closeTypeahead() {
                        var $input = $(this), typeahead;
                        if (typeahead = $input.data(typeaheadKey)) {
                            typeahead.close();
                        }
                    }
                },
                val: function val(newVal) {
                    return !arguments.length ? getVal(this.first()) : this.each(setVal);
                    function setVal() {
                        var $input = $(this), typeahead;
                        if (typeahead = $input.data(typeaheadKey)) {
                            typeahead.setVal(newVal);
                        }
                    }
                    function getVal($input) {
                        var typeahead, query;
                        if (typeahead = $input.data(typeaheadKey)) {
                            query = typeahead.getVal();
                        }
                        return query;
                    }
                },
                destroy: function destroy() {
                    return this.each(unattach);
                    function unattach() {
                        var $input = $(this), typeahead;
                        if (typeahead = $input.data(typeaheadKey)) {
                            typeahead.destroy();
                            $input.removeData(typeaheadKey);
                        }
                    }
                }
            };
            $.fn.typeahead = function(method) {
                if (methods[method]) {
                    return methods[method].apply(this, [].slice.call(arguments, 1));
                } else {
                    return methods.initialize.apply(this, arguments);
                }
            };
            $.fn.typeahead.noConflict = function noConflict() {
                $.fn.typeahead = old;
                return this;
            };
        })();
    })();
});

define('autocomplete/main',[
    'jquery',
    './typeahead'
], function ($) {


    var qcUrl = "http://193.44.77.246/suggest?site=electrolux_se&client=default_frontend&access=p&max=10&format=rich&callback=?&q=%QUERY";
    var searchFieldSelector = '.nav-search [type="search"], .search-field [type="search"]';

    $(function () {
        $(searchFieldSelector).each(function (i, el) {
            if (qcUrl) {

                var suggestions = new Bloodhound({
                    datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                    queryTokenizer: Bloodhound.tokenizers.whitespace,
                    remote: {
                        url: qcUrl,
                        filter: function(suggestions) {
                            return $.map(suggestions.results, function(item) { return { name: item.name }; });
                        }
                    }
                });

                suggestions.initialize();

                $(searchFieldSelector).typeahead({
                    hint: false,
                    highlight: true,
                    minLength: 1
                },{
                    name: 'results',
                    displayKey: 'name',
                    source: suggestions.ttAdapter()
                });
            }
        });
    });
});

define('autocomplete', ['autocomplete/main'], function (main) { return main; });

/**
 * Initiates the site scripts
 */
define('init',[
    'jquery',
    'navigation',
    'search',
    'overlay',
    'form',
    'troubleshooter',
    'pagination',
    'pubsub',
    'pjax',
    'pubsubBreakpoints',
    'core',
    'autocomplete'
], function ($, navigation, search, overlay, form, troubleshooter, pagination, pubsub) {
    
    navigation.init();
    search.init();
    overlay.init();
    form.init();

    troubleshooter.init();

    pagination.init();

    // I'm not sure how to do this best yet. Will think out something.
    $('html').addClass('loaded');

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

    // layoutfix for non flexbox browsers.
    $('.no-flexbox .half >div:last-of-type').css('margin-left', '-1px');

});


require(["init"]);
}());