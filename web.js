var express = require('express');
var render = require('./render');

var app = express();

render.init();

app.get('/render.png', function(req, res) {
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
    render.render(data, function(err, result) {
        if (err) {
            res.set('Content-Type', 'application.json');
            res.json(result);
        } else {
            res.set('Content-Type', 'image/png')
            res.send(200, new Buffer(result, 'base64'));
        }
    });
});

app.listen(3000);
console.log('Listening on port 3000');
