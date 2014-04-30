var phantom = require('node-phantom');

var ph;
var nconf;
var noop = function() {};

exports.init = function(cfg, cb) {
    nconf = cfg;
    cb = cb || noop;

    phantom.create(function(err, instance) {
        ph = instance;
        cb();
    }, {
        parameters: nconf.get('phantom')
    });
}

exports.exit = function(cb) {
    cb = cb || noop;
    if (ph) {
        // https://github.com/alexscheelmeyer/node-phantom/issues/85
        ph.exit(function() {
            cb();
        });
    } else {
        console.error('ERROR: No phantom instance');
        cb();
    }
}

exports.render = function(data, handler) {
    ph.createPage(function (err, page) {
        page.onConsoleMessage = function(msg) {
            console.log('Page log:', msg);
        };

        page.onError = function(msg, trace) {
            var msgStack = ['ERROR: ' + msg];

            if (trace && trace.length) {
                msgStack.push('TRACE:');

                trace.forEach(function(t) {
                    msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
                });
            }

            console.error(msgStack.join('\n'));
        };

        var ua = data.userAgent || nconf.get('userAgent');
        setUserAgent(page, ua);

        page.open(data.url, function(err, status) {
            if (status != 'success'){
                handler(false, {
                    error: 'open_fail',
                    message: 'Не удалось открыть страницу'
                });
                return;
            }
            page.set('zoomFactor', data.zoom);
            if (data.width && data.height) {
                page.set('viewportSize', {
                    width: data.width,
                    height: data.height
                });
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
                    var doRender = function() {
                        page.renderBase64('png', function(err, data) {
                            handler(true, data);
                        });
                    }
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
        });
    });
}

function waitFor(testFx, onReady, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000,
    start = new Date().getTime(),
    condition = false,
    interval = setInterval(function() {
        var now = new Date().getTime();
        if ( ((now - start) < maxtimeOutMillis) && !condition ) {
            condition = testFx()
        } else {
            onReady(condition);
            clearInterval(interval);
        }
    }, 250);
}

function setUserAgent(page, ua) {
    // https://github.com/alexscheelmeyer/node-phantom/issues/83
    // Хак! Не поддерживает вложенные свойства, но есть eval
    page.setFn('EVIL_EVAL', 'page.settings.userAgent = "' + ua + '"');
}
