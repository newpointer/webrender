var express = require('express');
var nconf = require('nconf');
var render = require('./render');

var app = express();

nconf.argv().file({
    file: './defaults.json'
});

render.init(nconf);

app.get('/render.png', function(req, res) {
    if (!req.query.url){
        res.send(400, {
            error: 'url_required',
            message: 'Параметр url обязателен'
        });
        return;
    }
    var data = {
        timeout: req.query.timeout,
        zoom: req.query.zoom || 1,
        width: req.query.width,
        height: req.query.height,
        url: req.query.url,
        userAgent: req.query.userAgent,
        // Какая глобальная переменная должна стать true для готовности страницы
        check: req.query.check,
        delay: req.query.delay
    };

    var start = new Date().getTime();
    render.render(data, function(success, result) {
        var msg, now = new Date().getTime();
        if (success) {
            res.set('Content-Type', 'image/png')
            res.send(200, new Buffer(result, 'base64'));

            msg = 'SUCCESS:';
        } else {
            res.set('Content-Type', 'application/json');
            res.json(result);

            msg = 'ERROR: ' + JSON.stringify(result);
        }
        console.log(msg + ' ' + JSON.stringify(data) + ' in ' + (now - start) + ' ms');
    });
});

console.log('Config: ', JSON.stringify(nconf.get()));

app.listen(nconf.get('port'));
console.log('Listening on port ' + nconf.get('port'));

