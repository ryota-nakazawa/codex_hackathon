const http = require("http");
const { config } = require("./config");
const { createApp } = require("./app");

const server = http.createServer(createApp());

server.listen(config.port, config.host, () => {
  process.stdout.write(`Dental AI PoC listening on http://${config.host}:${config.port}\n`);
});
