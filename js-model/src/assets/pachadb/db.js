import { uuidv7 } from "uuidv7";

function createUniqueId() {
  return uuidv7();
}

const createDB = (datoms = [], txIdCounter = 1) => ({
  datoms,
  txIdCounter,
});

const createDatom = (eId, a, v, txId, isAdded = true) => {
  return [eId, a, v, txId, isAdded];
};

const processFact = (fact) => {
  let entityId = createUniqueId();
  let datoms = [];

  for (const [attr, value] of Object.entries(fact)) {
    if (attr === "id") continue;

    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (typeof v === "object" && v !== null) {
          const [refId, nestedDatoms] = processFact(v);
          datoms.push(createDatom(entityId, attr, refId, txId));
          datoms = datoms.concat(nestedDatoms);
        } else {
          datoms.push(createDatom(entityId, attr, v, txId));
        }
      });
    } else if (typeof value === "object" && value !== null) {
      const [refId, nestedDatoms] = processFact(value);
      datoms.push(createDatom(entityId, attr, refId, txId));
      datoms = datoms.concat(nestedDatoms);
    } else {
      datoms.push(createDatom(entityId, attr, value, txId));
    }
  }

  return [entityId, datoms];
};

const transact = (db, facts) => {
  const txId = db.txIdCounter;

  const newDatoms = facts.flatMap((fact) => {
    const [_, factDatoms] = processFact(fact);
    return factDatoms;
  });

  return {
    ...db,
    datoms: [...db.datoms, ...newDatoms],
    txIdCounter: txId + 1,
  };
};

let db = createDB();
transact(db, [
  {
    name: "Bruce Wayne",
    age: 32,
    gender: "M",
    alias: "Batman",
    powers: ["rich", "martial arts"],
    weapons: ["batarang", "batmobile"],
    alignment: "Chaotic Good",
    nemesis: [{ name: "Joker" }, { name: "Bane" }],
  },
]);

export { createDB, transact };
