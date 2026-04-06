#! /bin/bash

if [ -z $1 ]; then
  echo "First argument of version string is required, current version is below"
  cat ./web-server/src/settings.js | grep serverVersion
  exit 1
fi

BUILD_VERSION="$1"

BUILD_DATE=$(date +'%B %d, %Y')

echo "Version $BUILD_VERSION - Built $BUILD_DATE"

sed -i -E "s/serverVersion: '{1}(.*?)'{1}/serverVersion: '${BUILD_VERSION}'/" ./web-server/src/settings.js
sed -i -E "s/buildDate: '{1}(.*?)'{1}/buildDate: '${BUILD_DATE}'/" ./web-server/src/settings.js
sed -i -E "s/clientVersion = '{1}(.*?)'{1}/clientVersion = '${BUILD_VERSION}'/" ./web-client/src/settings.js
sed -i -E "s/buildDate = '{1}(.*?)'{1}/buildDate = '${BUILD_DATE}'/" ./web-client/src/settings.js
sed -i -E "s/versionName \\\"{1}(.*?)\\\"{1}/versionName \\\"${BUILD_VERSION}\\\"/" ./android-client/build.gradle
sed -i -E "s/ClientVersion = \\\"{1}(.*?)\\\"{1}/ClientVersion = \\\"${BUILD_VERSION}\\\"/" ./android-client/src/com/simplepathstudios/snowgloo/SnowglooSettings.java
sed -i -E "s/BuildDate = \\\"{1}(.*?)\\\"{1}/BuildDate = \\\"${BUILD_DATE}\\\"/" ./android-client/src/com/simplepathstudios/snowgloo/SnowglooSettings.java
