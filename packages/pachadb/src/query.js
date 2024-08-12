import { isEmpty as isEmptyObject } from "./obj.js";

const matchCondition = (entity, condition) => {
  for (const [attr, value] of Object.entries(condition)) {
    if (entity[attr] !== value) {
      return false;
    }
  }
  return true;
};

// Helper function to evaluate OR conditions
const evaluateOr = (entity, orConditions) => {
  return orConditions.some((condition) => matchCondition(entity, condition));
};

// Group datoms by entity ID
const groupDatomsByEntity = (datoms) => {
  const entities = {};
  datoms.forEach((datom) => {
    const [eId, a, v] = datom;
    if (!entities[eId]) {
      entities[eId] = {};
    }
    entities[eId][a] = v;
  });
  return entities;
};

// Main query execution function
const executeQuery = (dbs, query) => {
  const results = {};

  for (const [entityName, entityQuery] of Object.entries(query)) {
    const allDatoms = dbs.flatMap((db) => DB.datoms(db));

    const whereClause = entityQuery.$?.where || {};
    const entities = groupDatomsByEntity(allDatoms);

    results[entityName] = Object.entries(entities)
      .filter(([eId, entity]) => {
        if (!eId.startsWith(`${entityName}:`)) {
          return false;
        }

        if (isEmptyObject(whereClause)) return true;

        if (whereClause.or) {
          return evaluateOr(entity, whereClause.or);
        }

        return matchCondition(entity, whereClause);
      })
      .map(([eId, entity]) => Object.entries(entity).map(([a, v]) => [eId, a, v, null, true]))
      .flat();
  }

  return results;
};

export default { executeQuery };
