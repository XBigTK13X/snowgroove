#! /bin/bash

cd web-client
npm run build
cd ..
rm -rf ./web-server/src/web-build
cp -r ./web-client/build ./web-server/src/web-build
