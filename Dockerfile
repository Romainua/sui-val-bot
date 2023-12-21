FROM node:18.12.1

WORKDIR /usr/src/bot

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "npm", "start" ]
