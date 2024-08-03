import { uuidv7 } from "uuidv7";
const createFact = (entityId, attribute, value, operation = "ASSERT", origin = "CLIENT") => ({
  id: uuidv7(),
  entityId,
  attribute,
  value,
  clientTxId: uuidv7(),
  serverTxId: null,
  operation,
  origin,
});
