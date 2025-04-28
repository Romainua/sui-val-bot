FROM node:18

WORKDIR /usr/src/bot

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "npm", "start" ]
