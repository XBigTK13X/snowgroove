#! /bin/bash

docker build -t xbigtk13x/snowgloo .

if [ ! -z $1 ]; then
  docker push xbigtk13x/snowgloo
fi
