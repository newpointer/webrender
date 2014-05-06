var phantom = require('node-phantom');

var ph;
var nconf;
var noop = function() {};

function pageLog(msg) {
    console.log('Page log:', msg);
};

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
    ph.createPage(function(err, page) {
        page.onConsoleMessage = nconf.get('pageLog') ? pageLog : noop;

        new PageHandler(page, data, handler).open();
    });
}

function PageHandler(page, data, handler) {
    var status, statusText;

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
            if ( ((now - start) < maxtimeOutMillis) && !condition ) {
                condition = testFx()
            } else {
                onReady(condition);
                clearInterval(interval);
            }
        }, 250);
    };

    function handleOpen(err, st) {
        if (st !== 'success' || status !== 200) {
            handler(false, {
                error: 'open_fail',
                message: 'Не удалось открыть страницу',
                status: status,
                statusText: statusText
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
    };

    return {
        open: function() {
            page.open(data.url, handleOpen);
        }
    };
}
