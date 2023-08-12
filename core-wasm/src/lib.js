import * as uuid from "https://deno.land/std@0.194.0/uuid/mod.ts";

export const Fact = ({ entity, source, value, field, stated_at }) => ({
  entity,
  source,
  value,
  field,
  stated_at,
  id: `pachadb:fact/${uuid.v1.generate()}`,
});

export const consolidate = (facts) => {
  let facts_by_entity = facts.reduce((map, fact) => {
    map[fact.entity] = map[fact.entity] || [];
    map[fact.entity].push(fact);
    return map;
  }, {});

  Object.entries(facts_by_entity).map(([uri, facts]) => {
    let entity = {
      "pachadb/uri": uri,
      "pachadb/created_at": (new Date()).toISOString(),
    };

    let prior_facts = {};

    return facts.reduce((entity, fact) => {
      let prior_fact = prior_facts[fact.field] || false;
      if (prior_fact) {
        if (fact.stated_at > prior_fact.stated_at) {
          entity[fact.field] = fact.value;
          prior_facts[fact.field] = fact;
          entity["pachadb/last_updated_at"] = (new Date()).toISOString();
        }
      } else {
        entity[fact.field] = fact.value;
        prior_facts[fact.field] = fact;
        entity["pachadb/last_updated_at"] = (new Date()).toISOString();
      }
      return entity;
    }, entity);
  });
};
