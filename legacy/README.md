# snowgloo

Snowman's Igloo

A cool place to chill and listen to music.

## First time setup
Setup nvm. Use latest node stable.

In project root, run

```
npm install
cd web-server
npm install
cd ..
cd web-client
npm install
cd ..
```

Create a file called variables.sh. It will need at minimum.

```
#! /bin/bash

export SNOWGLOO_MEDIA_ROOT="/<absolute-path-to-repo>/.web-media"

export SNOWGLOO_DATABASE_DIR="./docker-volume/db/snowgloo"

export SNOWGLOO_WEB_API_URL='"http://localhost:5051/api/"'

export SNOWGLOO_MEDIA_SERVER_URL='http://localhost:5050'
```

Make a directory in the repo root called `.web-media`. All music for development goes in this folder.

## Developing
Adjust the parameters of `script/docker/test.sh` to match your environment. Run it. Then run `script/app/develop.sh` to restart the app from scratch.

A temporary directory will be created in the project root at `.docker-volume`. Some scripts can delete this from time to time.

## Why build another music player?

I wanted a media app that did two things.

1. Rely on a file system of organized music instead of a database
2. Android support from the ground up

There are a lot of open source options for playing music. Of the dozens I tried, [Ampache](https://github.com/ampache/ampache) and [Airsonic](https://github.com/airsonic/airsonic) were the closest in usability to what I wanted. They are supported by a large community, and that shows in their user experience. They are clunky and try to do a little bit of everything to please a large user base.

Snowgloo is tailored exactly how I want music to work. Media is already in a format that is easy to stream. Folders and files contain enough information to build a catalog. The clients are first and foremost consumers of media. If changes are needed to the catalog, then you tweak the file-system.

Android support was another motivator. Although there are a number of open source clients for the servers mentioned above, they all lack basic features like searching the library.

## How does it work?

It currently only works for me. There is a hard-configured list of servers to talk with and users to allow. If this project seems like it could be useful to you, then I am open to making the few changes necessary to make it server and user agnostic.

## What won't it do?

1. Snowgloo will never have metadata management.
    1. I was annoyed when other solutions started pinging third party services to do things like collect album art. I already have a curated collection, that sort of feature is wasted on my library.
1. Play anything other than music
    1. There are way better tools for handling other media. For video, [Jellyfin](https://github.com/jellyfin/jellyfin) is the way to go. Their ultra high definition and anime playback is lacking, but that's where [Snowby](https://github.com/XBigTK13X/snowby) comes in.
