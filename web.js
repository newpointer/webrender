var express = require('express');
var nconf = require('nconf');
var dateFormat = require('dateformat');
var render = require('./render');

var app = express();

nconf.argv().file({
    file: 'defaults.json'
});

render.init(nconf);

app.get('/render.png', function(req, res) {
    if (!req.query.url){
        res.json(400, {
            error: 'url_required',
            message: 'Параметр url обязателен'
        });
        return;
    }
    var data = {
        timeout: req.query.timeout,
        zoom: req.query.zoom || 1,
        url: req.query.url,
        userAgent: req.query.userAgent,
        // (Необязательно) Какая глобальная переменная должна стать true для готовности страницы
        check: req.query.check,
        // (Необязательно) Какой элемент рендерить
        selector: req.query.selector,
        delay: req.query.delay
    };

    var start = new Date();
    render.render(data, function(success, result) {
        var msg, now = new Date();
        if (success) {
            res.set('Content-Type', 'image/png')
            res.send(200, new Buffer(result, 'base64'));

            msg = '[SUCCESS]';
        } else {
            res.json(500, result);

            msg = '[ERROR] ' + JSON.stringify(result);
        }
        console.log(dateFormat(now, 'dd.mm.yyyy HH:MM:ss') + ' ' + msg + ' ' + JSON.stringify(data) + ' in ' + (now.getTime() - start.getTime()) + ' ms');
    });
});

console.log('Config: ', JSON.stringify(nconf.get()));

app.listen(nconf.get('port'));
console.log('Listening on port ' + nconf.get('port'));

