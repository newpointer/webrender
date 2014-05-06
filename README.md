Установка
---------
* [Node.js](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager#opensuse--sle)
* [Phantom.js](http://phantomjs.org/download.html)
    
        ln -s /srv/phantomjs-1.9.7-linux-i686/bin/phantomjs /usr/bin/

* [Forever](https://github.com/nodejitsu/forever#installation) / [Keep a node.js server up with Forever](http://blog.nodejitsu.com/keep-a-nodejs-server-up-with-forever/)
* [webrender](http://repo.nkb/git/gitweb.cgi?p=nullpointer/webrender.git;a=summary)

        git clone git@repo.nkb:nullpointer/webrender.git
        cd webrender && npm install
        forever start /srv/webrender/web.js


Кеш PhantomJS
-------------
Параметр:
    'disk-cache': true
Расположение:
    QDesktopServices::CacheLocation
    ~/.qws/cache/Ofi Labs/PhantomJS/


Нормальное отображение шрифтов
------------------------------

        http://www.infinality.net/blog/
        https://launchpad.net/~no1wantdthisname/+archive/ppa
        http://www.webupd8.org/2013/06/better-font-rendering-in-linux-with.html

OpenSUSE:

        zypper ar http://download.opensuse.org/repositories/home:/andtecheu:/infinality/openSUSE_12.1/ infinality
        zypper ref && zypper in freetype-infinality fontconfig-infinality
        zypper in fetchmsttfonts pullin-msttf-fonts
        bash /etc/fonts/infinality/infctl.sh setstyle
        forever restart /srv/webrender/web.js

Рендеринг
---------
Из консоли:

        curl "http://localhost:3000/render.png?delay=500&url=http://localhost:8080/nkbrelation/" > page.png

[Пример отчета](http://relations.nkb:8080/nkbrelation/internal/report/534eb884e4b005a5d2fea86b) в браузере:

        http://relations.nkb:3000/render.png?check=_REPORT_READY_&url=http://relations.nkb:8080/nkbrelation/internal/report/534eb884e4b005a5d2fea86b
