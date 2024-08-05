const entityId = (datom) => datom[0];
const attribute = (datom) => datom[1];
const value = (datom) => datom[2];
const txId = (datom) => datom[3];
const isAdded = (datom) => datom[4];

export default { entityId, attribute, value, txId, isAdded };
