var fs = require('fs');
var render = require('./render');

function save(name, data, cb) {
    fs.writeFile(name, data, function(err) {
        if(err) {
            console.log(err);
        }
        cb();
    });
}

render.init(function() {
    var data = {
        timeout: 10000,
        zoom: 1,
        width: 1024,
        height: 768,
        url: __dirname + '/canvas/report.html',
        // Какая глобальная переменная должна стать true для готовности страницы
        check: 'REPORT_READY'
    };
    render.render(data, function(success, result, time) {
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
