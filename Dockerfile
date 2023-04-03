FROM node:16-alpine3.16

RUN apk add \
    bash \
    ca-certificates
    
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev
# install dependencies
RUN npm install knex pg

COPY . .    
RUN chmod +x ./entrypoint.sh
EXPOSE 3000

CMD ["./entrypoint.sh"]