#! /bin/bash
docker rm -f snowgroove
sudo rm -rf .docker-volume/
script/dev-docker-services.sh
script/dev-run-all.sh