#! /bin/bash

if [ -z $1 ];then
    cd web-server
    alembic upgrade head
else
    alembic -c /app/docker/alembic.ini upgrade head
    rabbitmqctl add_user snowgroove snowgroove
    rabbitmqctl set_user_tags snowgroove administrator
    rabbitmqctl set_permissions -p / snowgroove ".*" ".*" ".*"
fi

