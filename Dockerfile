FROM --platform=linux/amd64 node:19-alpine3.16

RUN apk add \
    bash \
    ca-certificates

RUN mkdir -p /usr/local/share/ca-certificates  \
    && chmod 333 /usr/local/share/ca-certificates 
    # && chmod 333 /etc/ssl/certs # this doesn't work

# RUN addgroup -g 2001 -S lnurl && adduser -u 1001 -S lnurl -G lnurl

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev
# install dependencies
RUN npm install knex pg

COPY . .    
RUN chmod +x ./entrypoint.sh 
    # && chown lnurl:lnurl -R /usr/src/app

EXPOSE 3000
# USER lnurl
CMD ["./entrypoint.sh"]