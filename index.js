/**
 * @version   2.0.1 - see https://github.com/jerrybendy/vue-touch-events
 * @author    Jerry Bendy
 * @author    Kris Erickson (additions)
 * Forked from 2.0.0 2019-10-01
 */

function touchX(event) {
    if(event.type.indexOf("mouse") !== -1){
        return event.clientX;
    }
    return event.touches[0].clientX;
}

function touchY(event) {
    if(event.type.indexOf("mouse") !== -1){
        return event.clientY;
    }
    return event.touches[0].clientY;
}

const vueTouchEvents = {
    install: function (Vue, options) {

        // Set default options
        options = Object.assign({}, {
            disableClick: false,
            tapTolerance: 10,
            swipeTolerance: 30,
            longTapTimeInterval: 400,
            longPressDuration: 800,
            touchClass: ''
        }, options || {});


        function touchStartEvent(event) {
            const $this = this.$$touchObj,
                isTouchEvent = event.type.indexOf("touch") >= 0,
                isMouseEvent = event.type.indexOf("mouse") >= 0;

            if (isTouchEvent) {
                $this.lastTouchStartTime = event.timeStamp
            }

            if (isMouseEvent && $this.lastTouchStartTime && event.timeStamp - $this.lastTouchStartTime < 350) {
                return;
            }

            $this.longPressTimeout = setTimeout(() => {
                if ($this.touchStarted) {
                    triggerEvent(event, this, 'longpress')
                }
            }, options.longPressDuration);

            if ($this.touchStarted) {
                return;
            }

            addTouchClass(this);

            $this.touchStarted = true;

            $this.touchMoved = false;
            $this.swipeOutBounded = false;

            $this.startX = touchX(event);
            $this.startY = touchY(event);

            $this.currentX = 0;
            $this.currentY = 0;

            $this.touchStartTime = event.timeStamp;

            triggerEvent(event, this, 'start')
        }

        function touchMoveEvent(event) {
            const $this = this.$$touchObj;

            $this.currentX = touchX(event);
            $this.currentY = touchY(event);

            if (!$this.touchMoved) {
                var tapTolerance = options.tapTolerance;

                $this.touchMoved = Math.abs($this.startX - $this.currentX) > tapTolerance ||
                    Math.abs($this.startY - $this.currentY) > tapTolerance;

                if($this.touchMoved){
                    triggerEvent(event, this, 'moved')
                }

            } else if (!$this.swipeOutBounded) {
                var swipeOutBounded = options.swipeTolerance;

                $this.swipeOutBounded = Math.abs($this.startX - $this.currentX) > swipeOutBounded &&
                    Math.abs($this.startY - $this.currentY) > swipeOutBounded
            }

            if($this.touchMoved){
                triggerEvent(event, this, 'moving')
            }
        }

        function touchCancelEvent() {
            var $this = this.$$touchObj;

            removeTouchClass(this);

            $this.touchStarted = $this.touchMoved = false;
            if ($this.longPressTimeout) {
                clearTimeout($this.longPressTimeout);
                $this.longPressTimeout = 0;
            }
            $this.startX = $this.startY = 0
        }

        function touchEndEvent(event) {
            var $this = this.$$touchObj,
                isTouchEvent = event.type.indexOf("touch") >= 0,
                isMouseEvent = event.type.indexOf("mouse") >= 0;

            if (isTouchEvent) {
                $this.lastTouchEndTime = event.timeStamp
            }

            if (isMouseEvent && $this.lastTouchEndTime && event.timeStamp - $this.lastTouchEndTime < 350) {
                return
            }

            $this.touchStarted = false;
            if ($this.longPressTimeout) {
                clearTimeout($this.longPressTimeout);
                $this.longPressTimeout = 0;
            }

            removeTouchClass(this);

            // Fix #33, Trigger `end` event when touch stopped
            triggerEvent(event, this, 'end');

            if (!$this.touchMoved) {
                // detect if this is a longTap event or not
                if ($this.callbacks.longtap && event.timeStamp - $this.touchStartTime > options.longTapTimeInterval) {
                    event.preventDefault();
                    triggerEvent(event, this, 'longtap')

                } else {
                    // emit tap event
                    triggerEvent(event, this, 'tap')
                }

            } else if (!$this.swipeOutBounded) {
                var swipeOutBounded = options.swipeTolerance, direction;

                if (Math.abs($this.startX - $this.currentX) < swipeOutBounded) {
                    direction = $this.startY > $this.currentY ? "top" : "bottom"

                } else {
                    direction = $this.startX > $this.currentX ? "left" : "right"
                }

                // Only emit the specified event when it has modifiers
                if ($this.callbacks['swipe.' + direction]) {
                    triggerEvent(event, this, 'swipe.' + direction, direction)

                } else {
                    // Emit a common event when it has no any modifier
                    triggerEvent(event, this, 'swipe', direction)
                }
            }
        }

        function mouseEnterEvent() {
            addTouchClass(this)
        }

        function mouseLeaveEvent() {
            removeTouchClass(this)
        }

        function triggerEvent(e, $el, eventType, param) {
            var $this = $el.$$touchObj;

            // get the callback list
            var callbacks = $this.callbacks[eventType] || [];
            if (callbacks.length === 0) {
                return null
            }

            for (var i = 0; i < callbacks.length; i++) {
                var binding = callbacks[i];

                if (binding.modifiers.stop) {
                    e.stopPropagation();
                }

                if (binding.modifiers.prevent) {
                    e.preventDefault();
                }

                // handle `self` modifier`
                if (binding.modifiers.self && e.target !== e.currentTarget) {
                    continue
                }

                if (typeof binding.value === 'function') {
                    if (param) {
                        binding.value(param, e)
                    } else {
                        binding.value(e)
                    }
                }
            }
        }

        function addTouchClass($el) {
            var className = $el.$$touchClass || options.touchClass;
            className && $el.classList.add(className)
        }

        function removeTouchClass($el) {
            var className = $el.$$touchClass || options.touchClass;
            className && $el.classList.remove(className)
        }

        Vue.directive('touch', {
            bind: function ($el, binding) {

                $el.$$touchObj = $el.$$touchObj || {
                    // an object contains all callbacks registered,
                    // key is event name, value is an array
                    callbacks: {},
                    // prevent bind twice, set to true when event bound
                    hasBindTouchEvents: false
                };


                // register callback
                var eventType = binding.arg || 'tap';
                switch (eventType) {
                    case 'swipe':
                        var _m = binding.modifiers;
                        if (_m.left || _m.right || _m.top || _m.bottom) {
                            for (var i in binding.modifiers) {
                                if (binding.modifiers.hasOwnProperty(i) && ['left', 'right', 'top', 'bottom'].indexOf(i) >= 0) {
                                    const _e = 'swipe.' + i;
                                    $el.$$touchObj.callbacks[_e] = $el.$$touchObj.callbacks[_e] || [];
                                    $el.$$touchObj.callbacks[_e].push(binding)
                                }
                            }
                        } else {
                            $el.$$touchObj.callbacks.swipe = $el.$$touchObj.callbacks.swipe || [];
                            $el.$$touchObj.callbacks.swipe.push(binding)
                        }
                        break;

                    default:
                        $el.$$touchObj.callbacks[eventType] = $el.$$touchObj.callbacks[eventType] || [];
                        $el.$$touchObj.callbacks[eventType].push(binding)
                }

                // prevent bind twice
                if ($el.$$touchObj.hasBindTouchEvents) {
                    return
                }

                $el.addEventListener('touchstart', touchStartEvent, {passive: true});
                $el.addEventListener('touchmove', touchMoveEvent, {passive: true});
                $el.addEventListener('touchcancel', touchCancelEvent);
                $el.addEventListener('touchend', touchEndEvent);

                $el.addEventListener('mousedown', touchStartEvent);
                $el.addEventListener('mousemove', touchMoveEvent);
                $el.addEventListener('mouseup', touchEndEvent);
                $el.addEventListener('mouseenter', mouseEnterEvent);
                $el.addEventListener('mouseleave', mouseLeaveEvent);

                // set bind mark to true
                $el.$$touchObj.hasBindTouchEvents = true
            },

            unbind: function ($el) {
                $el.removeEventListener('touchstart', touchStartEvent);
                $el.removeEventListener('touchmove', touchMoveEvent);
                $el.removeEventListener('touchcancel', touchCancelEvent);
                $el.removeEventListener('touchend', touchEndEvent);

                $el.removeEventListener('mousedown', touchStartEvent);
                $el.removeEventListener('mousemove', touchMoveEvent);
                $el.removeEventListener('mouseup', touchEndEvent);
                $el.removeEventListener('mouseenter', mouseEnterEvent);
                $el.removeEventListener('mouseleave', mouseLeaveEvent);

                // remove vars
                delete $el.$$touchObj;
            }
        });

        Vue.directive('touch-class', {
            bind: function ($el, binding) {
                $el.$$touchClass = binding.value
            },
            unbind: function ($el) {
                delete $el.$$touchClass
            }
        })
    }
};


/*
 * Exports
 */
if (typeof module === 'object') {
    module.exports = vueTouchEvents

} else if (typeof define === 'function' && define.amd) {
    define([], function () {
        return vueTouchEvents
    })
} else if (window.Vue) {
    window.vueTouchEvents = vueTouchEvents;
    Vue.use(vueTouchEvents)
}
