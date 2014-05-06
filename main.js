var fs = require('fs');
var nconf = require('nconf');
var render = require('./render');

nconf.argv().file({
    file: 'defaults.json'
});

nconf.defaults({
    'data':{
        timeout: 10000,
        zoom: 1,
        url: __dirname + '/canvas/adelanta.html',
        // Какая глобальная переменная должна стать true для готовности страницы
        check: 'REPORT_READY'
    }
});

function save(name, data, cb) {
    fs.writeFile(name, data, function(err) {
        if (err) {
            console.error(err);
        }
        cb();
    });
}

function shutdown(code) {
    render.exit(function() {
        process.exit(code);
    });
}

render.init(nconf, function() {
    render.render(nconf.get('data'), function(success, result, time) {
        if (time) {
            console.log('Время: ' + time + 'мс');
        }
        if (success) {
            console.log('Сохраняем файл...');
            save('out/adelanta.png', new Buffer(result, 'base64'), function() {
                shutdown(0);
            });
        } else {
            console.log('Ошибка экспорта:', JSON.stringify(result));
            shutdown(1);
        }
    });
});
