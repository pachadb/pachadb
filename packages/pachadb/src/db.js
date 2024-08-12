import { uuidv7 } from "uuidv7";
import Query from "./query";
import Datom from "./datom";

// Domain Models
const DB = {
  create: (config = {}) => ({
    syncedDatoms: config.syncedDatoms || [],
    unsyncedDatoms: config.unsyncedDatoms || [],
    serverUrl: config.serverUrl || "ws://localhost:8080",
    syncInterval: config.syncInterval || 5000,
    isServer: config.isServer || false,
  }),

  datoms: (db) => [...db.syncedDatoms, ...db.unsyncedDatoms],

  addSyncedDatoms: (db, newDatoms) => {
    db.syncedDatoms.push(...newDatoms);
    return db;
  },

  getUnsyncedDatoms: (db) => db.unsyncedDatoms,

  getChangesAfter: (db, uuid) => {
    if (uuid === null) {
      // If uuid is null, return all datoms
      return DB.datoms(db);
    }
    // Otherwise, filter datoms with txId greater than the given uuid
    return DB.datoms(db).filter((datom) => Datom.txId(datom) > uuid);
  },

  getLatestSyncedTxId: (db) => {
    const syncedTxIds = db.syncedDatoms.map(Datom.txId);
    return syncedTxIds.length === 0 ? null : syncedTxIds.reduce((a, b) => (a > b ? a : b));
  },
};

const Transaction = {
  create: () => uuidv7(),

  processDatom: (txId, entityName, datom) => {
    const entityId = Datom.createEntityId(entityName, uuidv7());
    return Object.entries(datom).flatMap(([attr, value]) =>
      Array.isArray(value)
        ? value.map((v) => Datom.create(entityId, attr, v, txId))
        : [Datom.create(entityId, attr, value, txId)]
    );
  },

  apply: (db, datoms, entityName) => {
    const txId = Transaction.create();
    const newDatoms = datoms.flatMap((datom) => Transaction.processDatom(txId, entityName, datom));
    if (db.isServer) {
      db.syncedDatoms.push(...newDatoms);
    } else {
      db.unsyncedDatoms.push(...newDatoms);
    }
    return db;
  },
};

const ServerService = {
  rebase: (db, datoms) => {
    // Group datoms by their original transaction ID
    const datomsByTx = datoms.reduce((acc, datom) => {
      const txId = Datom.txId(datom);
      if (!acc[txId]) {
        acc[txId] = [];
      }
      acc[txId].push(datom);
      return acc;
    }, {});

    // Create a new transaction for each group and apply
    Object.values(datomsByTx).forEach((txDatoms) => {
      const newTxId = Transaction.create();
      const newDatoms = txDatoms.map((datom) =>
        Datom.create(
          Datom.createEntityId(Datom.entityName(datom), Datom.entityId(datom)),
          Datom.attribute(datom),
          Datom.value(datom),
          newTxId
        )
      );
      db.syncedDatoms.push(...newDatoms);
    });

    return db;
  },
};

// Application Services
const DBService = {
  insert: (db, entityName, facts) => Transaction.apply(db, facts, entityName),

  rejectTransactionsIds: (db, rejectedTransactions = []) => {
    if (!db.isServer) {
      db.unsyncedDatoms = db.unsyncedDatoms.filter((datom) => !rejectedTransactions.includes(Datom.txId(datom)));
    }
    return db;
  },

  removeTransactionIds: (db, txIds) => {
    if (!db.isServer) {
      db.unsyncedDatoms = db.unsyncedDatoms.filter((datom) => !txIds.has(Datom.txId(datom)));
    }
    return db;
  },

  confirmTransactionIds: (db, txIds) => {
    if (!db.isServer) {
      const newSyncedDatoms = db.unsyncedDatoms.filter((datom) => txIds.has(Datom.txId(datom)));
      db.syncedDatoms.push(...newSyncedDatoms);
      db.unsyncedDatoms = db.unsyncedDatoms.filter((datom) => !txIds.has(Datom.txId(datom)));
    }
    return db;
  },

  rebaseUnsyncedDatoms: (db, newSyncedDatoms) => {
    if (!db.isServer) {
      // Step 1: Remove any unsynced datoms that are now in the synced set
      const newSyncedTxIds = new Set(newSyncedDatoms.map(Datom.txId));
      const datomsToRebase = db.unsyncedDatoms.filter((datom) => !newSyncedTxIds.has(Datom.txId(datom)));

      // Step 2: Clear unsynced datoms and add new synced datoms
      db.unsyncedDatoms = [];
      db.syncedDatoms.push(...newSyncedDatoms);

      // Step 3: Reapply unsynced datoms using the insert function
      datomsToRebase.forEach((datom) => {
        const entityName = Datom.entityName(datom);
        DBService.insert(db, entityName, [datom]);
      });
    }
    return db;
  },
};

export default {
  createDB: DB.create,
  datoms: DB.datoms,
  getChangesAfter: DB.getChangesAfter,
  removeTransactionIds: DBService.removeTransactionIds,
  addSyncedDatoms: DB.addSyncedDatoms,
  getUnsyncedDatoms: DB.getUnsyncedDatoms,
  rejectTransactionsIds: DBService.rejectTransactionsIds,
  confirmTransactionIds: DBService.confirmTransactionIds,
  rebaseUnsyncedDatoms: DBService.rebaseUnsyncedDatoms,
  insert: DBService.insert,
  getLatestSyncedTxId: DB.getLatestSyncedTxId,
  ServerService,
  Query,
};
