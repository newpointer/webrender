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
        width: 1024,
        height: 768,
        url: __dirname + '/canvas/report.html',
        // Какая глобальная переменная должна стать true для готовности страницы
        check: 'REPORT_READY'
    }
});

function save(name, data, cb) {
    fs.writeFile(name, data, function(err) {
        if(err) {
            console.log(err);
        }
        cb();
    });
}

render.init(nconf, function() {
    render.render(nconf.get('data'), function(success, result, time) {
        if (time) {
            console.log('Время: ' + time + 'мс');
        }
        if (success) {
            console.log('Сохраняем файл...');
            save('example.png', new Buffer(result, 'base64'), function(){
                process.exit(0);
            });
        } else {
            console.log('Ошибка экспорта:', JSON.stringify(result));
            process.exit(1);
        }
    });
});
