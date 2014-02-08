#!/bin/bash
NODE=$(which nodejs || which node)

#$NODE web.js
$NODE main.js

#FONTCONFIG_FILE=`pwd`/fonts/fontconfig.xml FC_DEBUG=1 $NODE web.js
