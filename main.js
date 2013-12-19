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
            console.log(JSON.stringify(result));
        } else {
            console.log('Сохраняем файл...');
            save('example.png', new Buffer(result, 'base64'), function(){
                process.exit(0);
            });
        }
    });
});
