#! /bin/bash

source script/variables.sh

script/prod-build-web-client.sh

cd web-server
find . -type d -name "__pycache__" -exec rm -r {} +
cd ..

set -e
docker build -t $SNOWGROOVE_DOCKER_IMAGE .
set +e

version=`script/update-version.py read`

docker image tag $SNOWGROOVE_DOCKER_IMAGE $SNOWGROOVE_DOCKER_IMAGE:$version

if [ ! -z $1 ]; then
  docker push $SNOWGROOVE_DOCKER_IMAGE
  docker push $SNOWGROOVE_DOCKER_IMAGE:$version
fi
