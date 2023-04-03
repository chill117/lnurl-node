#!/bin/bash

# add self-signed lnd cert to system
mkdir -p /usr/local/share/ca-certificates
cp $LND_CERT_PATH /usr/local/share/ca-certificates/lnd.crt
update-ca-certificates

node cli.js server --host "$LNURL_HOST" \
	--port "$LNURL_PORT" \
	--lightning.backend "lnd" \
    --lightning.config "{\"hostname\": \"$LND_HOST:$LND_PORT\", \"macaroon\": \"$LND_MACAROON_PATH\", \"cert\": \"$LND_CERT_PATH\"}" \
    --store.backend "knex" \
    --store.config "{\"client\":\"postgres\",\"connection\":{\"host\":\"$POSTGRES_HOST\",\"user\":\"$POSTGRES_USER\",\"password\":\"$POSTGRES_PASSWORD\",\"database\":\"$POSTGRES_DB\"}}"