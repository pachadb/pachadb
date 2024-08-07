let dbs = {};
const server = Bun.serve({
  fetch(req, server) {
    const username = new URL(req.url).searchParams.get("username");
    const instance = new URL(req.url).searchParams.get("instance");
    if (!dbs[instance]) {
      dbs[instance] = PachaDB.createDB();
    }
    const db = dbs[instance];
    const success = server.upgrade(req, { data: { username, db, instance } });
    if (success) return undefined;

    return new Response(`Hello ${username}`);
  },
  websocket: {
    open(ws) {
      const msg = `${ws.data.username} has entered the chat`;
      ws.subscribe(ws.data.instance);
      //   server.publish("the-group-chat", msg);
    },
    message(ws, message) {
      // the server re-broadcasts incoming messages to everyone
      server.publish(ws.data.instance, `${ws.data.instance}/${ws.data.username}: ${message}`);
    },
    close(ws) {
      const msg = `${ws.data.username} has left the chat`;
      //   server.publish("the-group-chat", msg);
      ws.unsubscribe(ws.data.username);
    },
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);
