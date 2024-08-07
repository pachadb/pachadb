const entitySep = ":";
const entityId = (datom) => datom[0].split(entitySep)[1];
const entityName = (datom) => datom[0].split(entitySep)[0];
const attribute = (datom) => datom[1];
const value = (datom) => datom[2];
const txId = (datom) => datom[3];
const isAdded = (datom) => datom[4];

const createEntityId = (entityName, id) => {
  return `${entityName}${entitySep}${id}`;
};

const create = (eId, a, v, txId, isAdded = true) => {
  return [eId, a, v, txId, isAdded];
};

export default { createEntityId, create, entityId, entityName, attribute, value, txId, isAdded };
