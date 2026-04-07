#! /bin/bash

if [ -z $1 ];then
    cd web-server
    uv run alembic upgrade head
else
    uv run alembic -c /app/docker/alembic.ini upgrade head
    rabbitmqctl add_user snowgroove snowgroove
    rabbitmqctl set_user_tags snowgroove administrator
    rabbitmqctl set_permissions -p / snowgroove ".*" ".*" ".*"
fi

