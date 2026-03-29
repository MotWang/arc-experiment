FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build:pools
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
