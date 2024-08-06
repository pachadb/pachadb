const server = Bun.serve({
  fetch(req, server) {
    const username = new URL(req.url).searchParams.get("username");
    const success = server.upgrade(req, { data: { username } });
    if (success) return undefined;

    return new Response(`Hello ${username}`);
  },
  websocket: {
    open(ws) {
      const msg = `${ws.data.username} has entered the chat`;
      ws.subscribe(ws.data.username);
      //   server.publish("the-group-chat", msg);
    },
    message(ws, message) {
      // the server re-broadcasts incoming messages to everyone
      server.publish(ws.data.username, `${ws.data.username}: ${message}`);
    },
    close(ws) {
      const msg = `${ws.data.username} has left the chat`;
      //   server.publish("the-group-chat", msg);
      ws.unsubscribe(ws.data.username);
    },
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);
