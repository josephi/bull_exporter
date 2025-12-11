FROM node:22-bookworm-slim as build-env

RUN mkdir -p /src
WORKDIR /src

COPY package.json .
RUN npm install --legacy-peer-deps

COPY . .
RUN node_modules/.bin/tsc -p .
RUN npm ci --production --legacy-peer-deps

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y tini bash && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["/usr/bin/tini", "--"]

RUN mkdir -p /src
RUN chown -R nobody:nogroup /src
WORKDIR /src
USER nobody

COPY setup/docker/main.sh /src/
COPY --chown=nobody:nogroup --from=build-env /src/node_modules /src/node_modules
COPY --chown=nobody:nogroup --from=build-env /src/dist /src/dist

CMD /src/main.sh
