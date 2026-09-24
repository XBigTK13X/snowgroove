#! /bin/bash

echo "Updating the database with the latest schema"
uv run alembic -c /app/docker/alembic.ini upgrade head
rabbitmqctl add_user snowgroove snowgroove
rabbitmqctl set_user_tags snowgroove administrator
rabbitmqctl set_permissions -p / snowgroove ".*" ".*" ".*"

echo "Launching the web api"
uv run uvicorn --fd 0 bin.server:app --log-config /app/docker/uvicorn-log.yaml