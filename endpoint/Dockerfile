FROM node:15.8.0-alpine
WORKDIR /src

EXPOSE 8000

CMD ["node", "server.js"]

COPY package.json /src
RUN npm install

COPY . /src