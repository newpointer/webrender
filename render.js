var phantom = require('node-phantom');

var ph;
var nconf;

function noop() {
}

function phantomCrashHandler(code, signal) {
    console.warn('phantom crash: signal', signal);
    // https://github.com/alexscheelmeyer/node-phantom/issues/80
    // Убиваем себя, чтобы внешний скрипт мог нас перезапустить
    process.exit(code ? 100 + code : 2);
}

exports.init = function(cfg, cb) {
    nconf = cfg;
    cb = cb || noop;

    phantom.create(function(err, instance) {
        ph = instance;
        ph._phantom.on('exit', phantomCrashHandler);
        cb();
    }, {
        parameters: nconf.get('phantom')
    });
};

exports.exit = function(cb) {
    cb = cb || noop;
    if (ph) {
        ph._phantom.removeListener('exit', phantomCrashHandler);
        // https://github.com/alexscheelmeyer/node-phantom/issues/85
        ph.exit(cb);
    } else {
        console.error('ERROR: No phantom instance');
        cb();
    }
};

exports.render = function(data, handler) {
    ph.createPage(function(err, page) {
        if (nconf.get('pageLog')) {
            page.onConsoleMessage = function(msg) {
                console.log('LOG:', msg);
            };
            page.onError = function(msg) {
                console.error('ERROR:', msg);
            };
        }
        new PageHandler(page, data, handler).open();
    });
};

function PageHandler(page, data, handler) {
    var status, statusText;

    // https://github.com/ariya/phantomjs/issues/10185
    page.onResourceReceived = function(response) {
        // NB: Точное совпадение URL. Может поломаться из-за небольших различий типа слеша в конце
        if (response.status !== null && response.stage === 'end' && response.url === data.url) {
            status = response.status;
            statusText = response.statusText;
        }
    };

    // https://github.com/alexscheelmeyer/node-phantom/issues/83
    // Хак! Не поддерживает вложенные свойства, но есть eval
    page.setFn('EVIL_EVAL', 'page.settings.userAgent = "' + (data.userAgent || nconf.get('userAgent')) + '"');

    function waitFor(testFx, onReady, timeOutMillis) {
        var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000,
                start = new Date().getTime(),
                condition = false,
                interval = setInterval(function() {
                    var now = new Date().getTime();
                    if (((now - start) < maxtimeOutMillis) && !condition) {
                        condition = testFx();
                    } else {
                        onReady(condition);
                        clearInterval(interval);
                    }
                }, 250);
    }

    function doRender() {
        if (typeof data.selector === 'undefined' && data.width && data.height) {
            page.set('viewportSize', {width: data.width, height: data.height});
        }
        page.evaluate(function(data) {
            document.body.style.webkitTransform = "scale(" + data.zoom + ")";
            document.body.style.webkitTransformOrigin = "0% 0%";
            if (data.selector) {
                var e = document.querySelector(data.selector);
                if (e) {
                    return e.getBoundingClientRect();
                }
            }
        }, function(err, clip) {
            if (clip) {
                if (clip.left < 0) {
                    clip.width += clip.left;
                    clip.left = 0;
                }
                if (clip.top < 0) {
                    clip.height += clip.top;
                    clip.top = 0;
                }
                page.set('clipRect', clip);
            }
            page.renderBase64('png', function(err, data) {
                handler(true, data);
            });
        }, data);
    }

    function handleOpen(err, st) {
        if (st !== 'success' || (status && status !== 200)) {
            handler(false, {
                error: 'open_fail',
                message: 'Не удалось открыть страницу',
                status: status,
                statusText: statusText
            });
            return;
        }
        var waitResult = false;
        waitFor(function() {
            page.evaluate(function(check) {
                // Специальная проверка на строковое значение
                if (check && check !== 'undefined') {
                    return this[check] === true;
                } else {
                    return (document.readyState === 'complete');
                }
            }, function(err, r) {
                waitResult = r;
            }, data.check);
            return waitResult;
        }, function(ready) {
            if (ready) {
                if (data.delay) {
                    setTimeout(doRender, data.delay);
                } else {
                    doRender();
                }
            } else {
                handler(false, {
                    error: 'timeout',
                    message: 'Превышен лимит ожидания'
                });
            }
        }, data.timeout);
    }

    return {
        open: function() {
            page.open(data.url, handleOpen);
        }
    };
}
