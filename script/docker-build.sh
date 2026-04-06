#! /bin/bash

source script/variables.sh

script/prod-build-web-client.sh

set -e
docker build -t $SNOWGROOVE_DOCKER_IMAGE .
set +e

version=`script/update-version.py read`

docker image tag $SNOWGROOVE_DOCKER_IMAGE $SNOWGROOVE_DOCKER_IMAGE:$version

if [ ! -z $1 ]; then
  docker push $SNOWGROOVE_DOCKER_IMAGE
  docker push $SNOWGROOVE_DOCKER_IMAGE:$version
fi
