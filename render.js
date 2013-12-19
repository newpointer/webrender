var phantom = require('node-phantom');
var ph;

exports.init = function(cb) {
    if (ph) {
        ph.exit();
    }
    phantom.create(function(err, instance) {
        ph = instance;
        if (cb) {
            cb();
        }
    }, {
        parameters:{
            'disk-cache': true
        //'max-disk-cache-size': 10 * 1024
        }
    });
}

exports.render = function(data, handler) {
    ph.createPage(function (err, page) {
        page.onConsoleMessage = function(msg) {
            console.log('page log:', msg);
        };
        console.log('data: ', data);
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
                    return check ? this[check] : (document.readyState === "complete");
                }, function(err, r) {
                    waitResult = r;
                }, data.check);
                return waitResult;
            }, function(ready, time) {
                if (ready) {
                    page.renderBase64('png', function(err, data){
                        handler(true, data, time)
                    });
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


