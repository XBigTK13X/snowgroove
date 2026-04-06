#! /bin/bash

mkdir .docker-volume
chmod -R 777 .docker-volume

docker rm -f snowgloo > /dev/null 2>&1

docker run --name snowgloo -d \
    -e SNOWGLOO_MEDIA_ROOT=/media/.web-media \
    -v ./.web-media:/media/.web-media \
    -v ./.docker-volume/asset:/snowgloo \
    -p 5050:5050 \
    xbigtk13x/snowgloo
