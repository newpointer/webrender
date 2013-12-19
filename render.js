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
    });
}

exports.render = function(data, handler) {
    ph.createPage(function (err, page) {
        //page.onConsoleMessage = function(msg) {
        //    console.log('page log:', msg);
        //};
        var canvas = __dirname + '/canvas/report.html';
        page.open(canvas, function(err, status) {
            page.set('zoomFactor', data.view.zoom);
            page.set('viewportSize', {
                width: data.view.width * data.view.zoom,
                height: data.view.height * data.view.zoom
            });
            page.evaluate(function(d) {
                render(d);
            }, function() {
                page.renderBase64('png', handler);
            }, data);
        });
    });
}

