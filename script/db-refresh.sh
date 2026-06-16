#! /bin/bash
docker rm -f snowgroove
sudo rm -rf .docker-volume/
cd web-server
find . -type d -name "__pycache__" -exec rm -r {} +
cd ..
script/dev-docker-services.sh
script/dev-run-all.sh
script/seed-data.sh