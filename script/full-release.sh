#! /bin/bash

source script/variables.sh

export NODE_ENV="production"

MODE="all"

if [ ! -z $1 ]; then
    MODE="$1"
fi

if [ "$MODE" == "server" ] || [ "$MODE" == "all" ]; then

echo "=-=- Building the container image -=-="
set -e
script/docker-build.sh push
set +e

echo "=-=- Running the latest version container on beast -=-="
ssh access@beast.9914.us "bash -c \"cd /mnt/docker; ./on/snowgroove.sh\""

fi

if [ "$MODE" == "client" ] || [ "$MODE" == "all" ]; then

echo "=-=- Build the apks -=-="
set -e
script/prod-generate-apks.sh
set +e

echo "=-=- Push the apks up to the file server -=-="
~/script/push-apks.py snowgroove

echo "=-=- Deploy the apks to all devices -=-="
~/script/remote-adb.py All deploy_snowgroove

fi

unset NODE_ENV