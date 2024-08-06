import { uuidv7 } from "uuidv7";
import Query from "./query";

function createUniqueId() {
  return uuidv7();
}

const createDB = (datoms = []) => ({
  datoms,
});

const createDatom = (eId, a, v, txId, isAdded = true) => {
  return [eId, a, v, txId, isAdded];
};

const processDatom = (txId, entityName, datom) => {
  let entityId = `${entityName}:${createUniqueId()}`;
  let datoms = [];

  for (const [attr, value] of Object.entries(datom)) {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        datoms.push(createDatom(entityId, attr, v, txId));
      });
    } else {
      datoms.push(createDatom(entityId, attr, value, txId));
    }
  }

  return [entityId, datoms];
};

const transact = (db, datoms, entityName) => {
  const txId = createUniqueId();

  const newDatoms = datoms.flatMap((datom) => {
    const [_, datoms] = processDatom(txId, entityName, datom);
    return datoms;
  });

  return {
    ...db,
    datoms: [...db.datoms, ...newDatoms],
  };
};

const insert = (db, entityName, facts) => {
  return transact(db, facts, entityName);
};

// let db = createDB();
// insert(db, "superheroes", [
//   {
//     name: "Bruce Wayne",
//     age: 32,
//     gender: "M",
//     alias: "Batman",
//     powers: ["rich", "martial arts"],
//     weapons: ["batarang", "batmobile"],
//     alignment: "Chaotic Good",
//     // Note(Danni) - we want to support nested facts, but we first need a schema to know which entity to reference
//     // nemesis: [{ name: "Joker" }, { name: "Bane" }],
//   },
// ]);

export default { createDB, insert, Query };
