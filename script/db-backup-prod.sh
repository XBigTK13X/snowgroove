#! /bin/bash

source script/variables.sh

PROD_DIR="root@beast.9914.us:/mnt/docker/volume/snowgroove/postgresql/"

LOCAL_DIR="$SNOWGROOVE_DB_BACKUP_DIR"

script/dev-kill-all.sh

docker rm -f snowgroove

sudo rm -rf .docker-volume/postgresql

sudo rsync -paHAXxv --numeric-ids --progress $PROD_DIR $LOCAL_DIR