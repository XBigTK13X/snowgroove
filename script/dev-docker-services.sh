#! /bin/bash

echo "Docker services working dir"

pwd

docker pull gitea.9914.us/xbigtk13x/snowgroove

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
    -p 10060:10060 \
    -p 10061:10061 \
    -p 10062:10062 \
    -p 10064:10064 \
    -p 10065:10065 \
    -v $(pwd)/.docker-volume/logs:/app/logs \
    -v $(pwd)/.docker-volume/postgresql:/var/lib/postgresql/data \
    -v $(pwd)/.docker-volume/rabbitmq:/var/lib/rabbitmq \
    -v $(pwd)/web-server/.snowgroove:/mnt/.snowgroove \
    -v /mnt/test-data:/mnt/test-data \
    -v /mnt/j-media/music:/mnt/j-media/music \
    gitea.9914.us/xbigtk13x/snowgroove

target_phrase="database system is ready to accept connections"
timeout_seconds=60
elapsed_seconds=0

until docker logs snowstream 2>&1 | grep -q "$target_phrase"; do
    if [ "$elapsed_seconds" -ge "$timeout_seconds" ]; then
        echo "Timed out waiting for database to be ready" >&2
        exit 1
    fi
    sleep 1
    elapsed_seconds=$((elapsed_seconds + 1))
done

echo "DB is online"