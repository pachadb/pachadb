import { serve } from "bun";
import Datom from "pachadb/src/datom";
import DB from "pachadb";
import { uuidv7 } from "uuidv7";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

// Domain Models

const Instance = {
  create: () => ({
    db: DB.createDB({ isServer: true }),
    clients: new Map(),
  }),
  getOrAddClient: (instance, clientId) => {
    if (!instance.clients.has(clientId)) {
      instance.clients.set(clientId, { lastSyncedTxId: null });
    }
    return instance;
  },
  updateClientSync: (instance, clientId, txId) => {
    if (instance.clients.has(clientId)) {
      instance.clients.get(clientId).lastSyncedTxId = txId;
    }
  },
  getUnsyncedDatoms: (instance, clientId) => {
    const client = instance.clients.get(clientId);
    return client ? DB.getChangesAfter(instance.db, client.lastSyncedTxId) : [];
  },
};

const SyncService = {
  handleSync: (instance, clientId, incomingDatoms) => {
    console.log(`[Server] Handling sync for client ${clientId}`);
    console.log(`[Server] Incoming datoms:`, incomingDatoms);

    const clientLastSyncedTxId = instance.clients.get(clientId)?.lastSyncedTxId || null;
    console.log(`[Server] Client's last synced txId:`, clientLastSyncedTxId);

    const processedTxIds = incomingDatoms.map(Datom.txId);
    DB.ServerService.rebase(instance.db, incomingDatoms);

    // Get all changes after the client's last synced transaction
    const datomsToSendToClient = Instance.getUnsyncedDatoms(instance, clientId);
    console.log(`[Server] Datoms to send to client:`, datomsToSendToClient);

    // Get the latest transaction ID from the server's DB
    const latestTxId = DB.getLatestSyncedTxId(instance.db);
    console.log(`[Server] Latest server txId:`, latestTxId);

    return {
      datomsToSendToClient,
      latestTxId,
      processedTxIds,
    };
  },
};

// Application Service

const ServerService = {
  getOrAddInstance: (instances, instanceId) => {
    if (!instances.has(instanceId)) {
      instances.set(instanceId, Instance.create());
    }
    return instances.get(instanceId);
  },

  handleSyncRequest: (instances, instanceId, clientId, incomingDatoms) => {
    let instance = ServerService.getOrAddInstance(instances, instanceId);

    instance = Instance.getOrAddClient(instance, clientId);

    const { datomsToSendToClient, latestTxId, processedTxIds } = SyncService.handleSync(
      instance,
      clientId,
      incomingDatoms
    );

    Instance.updateClientSync(instance, clientId, latestTxId);

    return {
      datoms: datomsToSendToClient,
      latestTxId: latestTxId,
      processedTxIds: processedTxIds,
    };
  },
};

// Server setup and request handling

const instances = new Map();

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const instanceId = url.searchParams.get("instance") || "default";
    const clientId = url.searchParams.get("clientId");

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (req.method === "POST" && url.pathname === "/sync") {
      if (!clientId) {
        return new Response("Client ID is required", { status: 400, headers: CORS_HEADERS });
      }

      console.log(`[Server] Sync request received for instance ${instanceId}, client ${clientId}`);

      const body = await req.json();
      console.log(`[Server] Received datoms from client:`, body.datoms);

      const response = ServerService.handleSyncRequest(instances, instanceId, clientId, body.datoms || []);
      console.log(`[Server] Sending response to client:`, response);

      return new Response(JSON.stringify(response), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
