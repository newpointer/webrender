var phantom = require("node-phantom");
var ph;

exports.init = function() {
    if (ph) {
        ph.exit();
    }
    phantom.create(function(err, instance) {
        ph = instance;
    });
}

exports.render = function(dataset, opts) {
    return ph.createPage(function (err, page) {
        page.onConsoleMessage = function(msg) {
            console.log('page log:', msg);
        };
        var canvas = __dirname + '/canvas/report.html';
        var data = {
            view: {
                zoom: 1,
                width: 1024,
                height: 768
            },
            report: {
                title: 'Новый Отчет',
                text: 'Это пример текста отчета'
            }
        };

        return page.open(canvas, function(err, status) {
            page.set('zoomFactor', data.view.zoom);

            page.set('viewportSize', {
                width: data.view.width * data.view.zoom,
                height: data.view.height * data.view.zoom
            });
            page.evaluate(function(d) {
                render(d);
            }, function() {
                page.render('example.png');
                ph.exit();
            }, data);
        });
    });
}



exports.init();

setTimeout(function() {
    exports.render({
        x: 1,
        y:2
    }, {
        z: 'hello',
        y: 'world'
    });
}, 1000);
