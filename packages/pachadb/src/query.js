import { isEmpty as isEmptyObject } from "./obj.js";
import Datom from "./datom.js";

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
const executeQuery = (db, query) => {
  const results = {};

  for (const [entityName, entityQuery] of Object.entries(query)) {
    const whereClause = entityQuery.$?.where || {};
    const entities = groupDatomsByEntity(db.datoms);

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
