import { uuidv7 } from "uuidv7";

function createUniqueId() {
  return uuidv7();
}

const createDB = (datoms = [], txIdCounter = 1) => ({
  datoms,
});

const createDatom = (eId, a, v, txId, isAdded = true) => {
  return [eId, a, v, txId, isAdded];
};

const processFact = (fact, txId) => {
  let entityId = createUniqueId();
  let datoms = [];

  for (const [attr, value] of Object.entries(fact)) {
    // Note(Danni) - not yet needed, re-add when working on schema
    // if (attr === "id") continue;

    if (Array.isArray(value)) {
      value.forEach((v) => {
        // if (typeof v === "object" && v !== null) {
        //   const [refId, nestedDatoms] = processFact(v);
        //   datoms.push(createDatom(entityId, attr, refId, txId));
        //   datoms = datoms.concat(nestedDatoms);
        // } else {
        datoms.push(createDatom(entityId, attr, v, txId));
        // }
      });
      // } else if (typeof value === "object" && value !== null) {
      //   const [refId, nestedDatoms] = processFact(value);
      //   datoms.push(createDatom(entityId, attr, refId, txId));
      //   datoms = datoms.concat(nestedDatoms);
    } else {
      datoms.push(createDatom(entityId, attr, value, txId));
    }
  }

  return [entityId, datoms];
};

const transact = (db, facts) => {
  const txId = createUniqueId();

  const newDatoms = facts.flatMap((fact) => {
    const [_, factDatoms] = processFact(fact, txId);
    return factDatoms;
  });

  return {
    ...db,
    datoms: [...db.datoms, ...newDatoms],
  };
};

const insert = (db, entityName, facts) => {
  const processedFacts = facts.map((obj) => {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      newObj[`${entityName}:${key}`] = value;
    }
    return newObj;
  });
  return transact(db, processedFacts);
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

export default { createDB, insert };
