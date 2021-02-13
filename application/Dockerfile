FROM node:15.8.0-alpine
WORKDIR /src

EXPOSE 8080
RUN npm install -g http-server

COPY package.json /src
RUN npm install

COPY . /src

RUN npm run build

CMD [ "http-server", "dist" ]