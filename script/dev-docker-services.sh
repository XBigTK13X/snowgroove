#! /bin/bash

source script/variables.sh

echo "Docker services working dir"

pwd

docker pull $SNOWGROOVE_DOCKER_IMAGE

docker rm -f snowgroove || true

mkdir -p .docker-volume/postgresql
mkdir -p .docker-volume/web-transcode
mkdir -p web-server/.snowgroove/thumbnail
chmod -R 777 .docker-volume/web-transcode

# Ports
# 10060  - postgres
# 10061 - rabbit gui
# 10062  - rabbit
# 10063  - snowgroove
# 10064    - nginx
# 10065  - supervisord gui

docker run -d \
    -e POSTGRES_PASSWORD=snowgroove \
    -e POSTGRES_USER=snowgroove \
    -e POSTGRES_DB=snowgroove \
    -e PGDATA=/var/lib/postgresql/data \
    -e RABBITMQ_LOGS=- \
    -e SNOWGROOVE_POSTGRES_PORT=10060 \
    -e PGPORT=10060 \
    -e SNOWGROOVE_LOG_FILE_PATH=/app/logs/snowgroove.log \
    --name snowgroove \
    --device /dev/dri:/dev/dri \
    --privileged \
    -p 10060:10060 \
    -p 10061:10061 \
    -p 10062:10062 \
    -p 10063:10063 \
    -p 10064:10064 \
    -p 10065:10065 \
    -v $(pwd)/.docker-volume/logs:/app/logs \
    -v $(pwd)/.docker-volume/postgresql:/var/lib/postgresql/data \
    -v $(pwd)/.docker-volume/rabbitmq:/var/lib/rabbitmq \
    -v $(pwd)/web-server/.snowgroove:/mnt/.snowgroove \
    -v /mnt/test-data:/mnt/test-data \
    -v /mnt/j-media/music:/mnt/j-media/music \
    $SNOWGROOVE_DOCKER_IMAGE

sleep 12

if [ -z "$1" ]; then
    script/db-migrate.sh
fi