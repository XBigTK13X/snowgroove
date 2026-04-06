#! /bin/bash

echo "Docker services working dir"

pwd

docker pull $SNOWGROOVE_DOCKER_IMAGE

docker rm -f snowgroove || true

mkdir -p .docker-volume/postgresql
mkdir -p .docker-volume/web-transcode
mkdir -p web-server/.snowgroove/thumbnail
chmod -R 777 .docker-volume/web-transcode

# Ports
# 5432  - postgres
# 15672 - rabbit gui
# 5672  - rabbit
# 8000  - snowgroove
# 80    - nginx
# 9001  - supervisord gui

docker run -d \
    -e POSTGRES_PASSWORD=snowgroove \
    -e POSTGRES_USER=snowgroove \
    -e POSTGRES_DB=snowgroove \
    -e PGDATA=/var/lib/postgresql/data \
    -e RABBITMQ_LOGS=- \
    -e SNOWGROOVE_LOG_FILE_PATH=/app/logs/snowgroove.log \
    --name snowgroove \
    --device /dev/dri:/dev/dri \
    --privileged \
    -p 9060:5432 \
    -p 9061:15672 \
    -p 9062:5672 \
    -p 9063:8000 \
    -p 9064:80 \
    -p 9065:9001 \
    -p 9066:1984 \
    -p 9067:9067 \
    -v $(pwd)/.docker-volume/logs:/app/logs \
    -v $(pwd)/.docker-volume/postgresql:/var/lib/postgresql/data \
    -v $(pwd)/.docker-volume/rabbitmq:/var/lib/rabbitmq \
    -v $(pwd)/web-server/.snowgroove:/mnt/.snowgroove \
    -v /mnt/test-data:/mnt/test-data \
    -v /mnt/j-media/music:/mnt/j-media/music
    $SNOWGROOVE_DOCKER_IMAGE

sleep 12

if [ -z "$1" ]; then
    script/db-migrate.sh
fi