var phantom = require('node-phantom');

var ph;
var nconf;

exports.init = function(cfg, cb) {
    if (ph) {
        ph.exit();
    }
    nconf = cfg;
    phantom.create(function(err, instance) {
        ph = instance;
        if (cb) {
            cb();
        }
    }, {
        parameters: nconf.get('phantom')
    });
}

exports.render = function(data, handler) {
    ph.createPage(function (err, page) {
        page.onConsoleMessage = function(msg) {
            console.log('page log:', msg);
        };
        console.log(JSON.stringify(data));

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
                    }else {
                        return (document.readyState === 'complete');
                    }
                }, function(err, r) {
                    waitResult = r;
                }, data.check);
                return waitResult;
            }, function(ready, time) {
                if (ready) {
                    var doRender = function() {
                        page.renderBase64('png', function(err, data){
                            handler(true, data, time)
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
                        message: 'Превышен лимит ожидания отчета'
                    }, time);
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
        if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
            condition = testFx()
        } else {
            onReady(condition, (new Date().getTime() - start));
            clearInterval(interval);
        }
    }, 250);
}

function setUserAgent(page, ua) {
    // https://github.com/alexscheelmeyer/node-phantom/issues/83
    // Хак! Не поддерживает вложенные свойства, но есть eval
    page.setFn('EVIL_EVAL', 'page.settings.userAgent = "' + ua + '"');
}
