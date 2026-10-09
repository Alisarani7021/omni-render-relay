// Omni - Render WS relay: client WebSocket <-> panel worker WebSocket.
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const TARGET = process.env.OMNI_TARGET || "wss://omni-nova-f61e.catclient-59gk2mui.workers.dev/VZLdh9Ft";

const wss = new WebSocketServer({ noServer: true });

function edBytes(req) {
  const tok = String(req.headers["sec-websocket-protocol"] || "").split(",")[0].trim();
  if (!tok) return null;
  try {
    const b64 = tok.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "===".slice((b64.length + 3) % 4);
    const bin = Buffer.from(pad, "base64");
    return bin.length ? bin : null;
  } catch (e) { return null; }
}

const server = http.createServer((req, res) => {
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === "websocket") {
    const early = edBytes(req);
    wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (client) => {
      const q = [];
      if (early) q.push(early);
      let opened = false;
      let remote = null;
      const kill = (why) => { try { client.close(1011, why); } catch (e) {} };
      client.on("message", (data) => {
        if (opened && remote && remote.readyState === WebSocket.OPEN) remote.send(data);
        else q.push(Buffer.from(data));
      });
      client.on("close", () => { if (remote) { try { remote.close(); } catch (e) {} } });
      client.on("error", () => { if (remote) { try { remote.close(); } catch (e) {} } });
      remote = new WebSocket(TARGET);
      remote.on("open", () => {
        opened = true;
        while (q.length && remote.readyState === WebSocket.OPEN) remote.send(q.shift());
        q.length = 0;
      });
      remote.on("message", (data) => { if (client.readyState === WebSocket.OPEN) client.send(data); });
      remote.on("close", (code, reason) => kill("upstream closed"));
      remote.on("error", () => kill("upstream error"));
    });
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("Omni mirror - Render relay alive");
});

server.listen(Number(process.env.PORT) || 10000);
