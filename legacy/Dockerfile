FROM node:16.13.0

RUN apt-get update && apt-get install nginx -y

WORKDIR /usr/src/app/web-server
COPY ./web-server/package.json ./package.json
COPY ./web-server/package-lock.json ./package-lock.json
RUN npm install

WORKDIR /usr/src/app/web-client
COPY ./web-client/package.json ./package.json
COPY ./web-client/package-lock.json ./package-lock.json
RUN npm install

WORKDIR /usr/src/app
COPY ./web-server/src ./web-server/src
COPY ./web-client/src ./web-client/src
COPY ./web-client/public ./web-client/public

WORKDIR /usr/src/app/web-client
RUN npm run build
RUN rm -rf /usr/src/app/web-server/src/web-build/
RUN cp -r /usr/src/app/web-client/build/ /usr/src/app/web-server/src/web-build/

COPY script/nginx/site.conf /etc/nginx/sites-enabled/default

EXPOSE 5050
WORKDIR /usr/src/app/web-server
CMD [ "/bin/bash","-c","nginx && node src/index" ]
