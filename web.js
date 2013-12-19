var express = require('express');
var render = require('./render');

var app = express();

render.init();

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
        // Какая глобальная переменная должна стать true для готовности страницы
        check: req.query.check
    };
    render.render(data, function(success, result, time) {
        if (success) {
            res.set('Content-Type', 'image/png')
            res.send(200, new Buffer(result, 'base64'));
        } else {
            res.set('Content-Type', 'application/json');
            res.json(result);
        }
    });
});

app.listen(3000);
console.log('Listening on port 3000');
