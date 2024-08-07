import { uuidv7 } from "uuidv7";
const uri = (...prefix) => `${prefix.join(":")}:${uuidv7()}`
const now = () => (new Date()).toISOString()

const fact = ({entity, field, value, statedAt=now()}) => {
  let f = {
    uri: uri("pachadb","fact"),
    tx: null,
    entity,
    field,
    value,
    statedAt
  };
  console.log("fact:", f);
  return f;
}

const transaction = facts => {
  let tx = uri("pachadb","tx");
  return facts.map(fact => ({tx, ...fact}))
}

const consolidate = (facts={}, entities={}) => {
  (Object.values(facts)).forEach(fact => {
    let entity = entities[fact.entity] || {uri: fact.entity}
    entity[fact.field] = entity[fact.field] || { value: null, history: [] }
    entity[fact.field].value = fact.value
    entity[fact.field].history.push(fact)
    entities[fact.entity] = entity
  })
  return entities
}

const storeFacts = (facts=[], store={}) => {
  facts.forEach(fact => {
    store[fact.uri] = fact;
  });
}

const STORE_FACTS = {}
const STORE_ENTITIES = {}
const STORE_OBJECTS = {}

const state = (facts) => {
  const tx = transaction(facts);
  storeFacts(tx, STORE_FACTS);
  consolidate(tx, STORE_ENTITIES);
}

const getEntity = uri => {
  STORE_ENTITIES[uri] = STORE_ENTITIES[uri] || {uri};
  return STORE_ENTITIES[uri]
}

const newObject = (uri, entity, opts) => {
  let proxy = new Proxy({uri, entity, facts: [], opts}, {
    get(target, field, received) {
      console.log("field", field);
      if (field === "save") return () => {
        state(target.facts);
        target.facts = [];
        target.opts.onUpdate();
      };
      return target.entity[field]?.value
    },
    set(target, field, value) {
      let newFact = fact({entity: target.uri, field, value});
      target.facts.push(newFact);
      return true
    }
  })

  STORE_OBJECTS[uri] = proxy;
  return proxy;
}

const getObject = (uri, opts) => {
  const entity = getEntity(uri);
  const obj = STORE_OBJECTS[uri] || newObject(uri, entity, opts)
  return obj;
}

export default { uri, fact, state, getObject }
