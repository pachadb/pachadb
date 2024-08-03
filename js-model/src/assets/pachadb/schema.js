// Enhanced schema structure
const createSchema = () => ({
  attributes: new Map(),
  uniqueAttributes: new Set(),
});

// Value types
const VALUE_TYPES = {
  BIGDEC: "bigdec",
  BIGINT: "bigint",
  BOOLEAN: "boolean",
  DOUBLE: "double",
  FLOAT: "float",
  INSTANT: "instant",
  KEYWORD: "keyword",
  LONG: "long",
  REF: "ref",
  STRING: "string",
  SYMBOL: "symbol",
  TUPLE: "tuple",
  UUID: "uuid",
  URI: "uri",
};

// Cardinality options
const CARDINALITY = {
  ONE: "one",
  MANY: "many",
};

// Uniqueness options
const UNIQUE = {
  IDENTITY: "identity",
  VALUE: "value",
};

// Enhanced addSchema function
const addSchema = (db, attrDef) => {
  const newSchema = { ...db.schema };
  const { identifier } = attrDef;

  if (!identifier) {
    throw new Error("Schema attribute must have an identifier");
  }

  const schemaAttr = {
    identifier,
    valueType: attrDef.valueType,
    cardinality: attrDef.cardinality || CARDINALITY.ONE,
    unique: attrDef.unique,
    isComponent: attrDef.isComponent || false,
    tupleAttrs: attrDef.tupleAttrs,
    tupleTypes: attrDef.tupleTypes,
    tupleType: attrDef.tupleType,
  };

  // Validate value type
  if (!Object.values(VALUE_TYPES).includes(schemaAttr.valueType)) {
    throw new Error(`Invalid value type: ${schemaAttr.valueType}`);
  }

  // Validate cardinality
  if (!Object.values(CARDINALITY).includes(schemaAttr.cardinality)) {
    throw new Error(`Invalid cardinality: ${schemaAttr.cardinality}`);
  }

  // Handle unique attributes
  if (schemaAttr.unique) {
    if (!Object.values(UNIQUE).includes(schemaAttr.unique)) {
      throw new Error(`Invalid unique value: ${schemaAttr.unique}`);
    }
    newSchema.uniqueAttributes.add(identifier);
  }

  // Validate tuple attributes
  if (schemaAttr.valueType === VALUE_TYPES.TUPLE) {
    if (!schemaAttr.tupleAttrs && !schemaAttr.tupleTypes && !schemaAttr.tupleType) {
      throw new Error("Tuple attributes must specify tupleAttrs, tupleTypes, or tupleType");
    }
  }

  newSchema.attributes.set(identifier, schemaAttr);

  return {
    ...db,
    schema: newSchema,
  };
};

// Enhanced createDB function
const createDB = (schema = createSchema(), datoms = [], entityIdCounter = 1, txIdCounter = 1) => ({
  schema,
  datoms,
  entityIdCounter,
  txIdCounter,
});

// Example usage
let db = createDB();

// {:db/ident       :person/email
//     :db/unique      :db.unique/identity
//     :db/valueType   :db.type/string
//     :db/cardinality :db.cardinality/one}
db = addSchema(db, {
  identity: "person/name",
  unique: UNIQUE.IDENTITY,
  attribute: "person/name",
  valueType: VALUE_TYPES.STRING,
  cardinality: CARDINALITY.ONE,
});

db = addSchema(db, {
  attribute: "person/aliases",
  valueType: VALUE_TYPES.STRING,
  cardinality: CARDINALITY.MANY,
  doc: "A person's aliases",
});

console.log(db.schema);
