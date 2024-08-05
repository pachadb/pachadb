import { isEmpty as isEmptyObject } from "./obj.js";
import Datom from "./datom.js";

const matchCondition = (datom, condition) => {
  for (const [attr, value] of Object.entries(condition)) {
    if (Datom.attribute(datom) === attr && Datom.value(datom) !== value) {
      return false;
    }
  }
  return true;
};

// Helper function to evaluate OR conditions
const evaluateOr = (datom, orConditions) => {
  return orConditions.some((condition) => matchCondition(datom, condition));
};

// Main query execution function
const executeQuery = (db, query) => {
  const results = {};

  for (const [entityName, entityQuery] of Object.entries(query)) {
    const whereClause = entityQuery.$?.where || {};

    results[entityName] = db.datoms.filter((datom) => {
      if (isEmptyObject(whereClause)) return true;

      if (whereClause.or) {
        return evaluateOr(datom, whereClause.or);
      }

      return matchCondition(datom, whereClause);
    });
  }

  return results;
};

export default { executeQuery };
