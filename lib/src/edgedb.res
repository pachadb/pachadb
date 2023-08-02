
module Uri: {
  type t
  let new : (~ns:string) => t
} = {
  type t = string
  let new = (~ns) => `app:${ns}:` ++ (Belt.Float.toString(Js.Date.now()))

}

module Uri_comparable = Belt.Id.MakeComparable({
  type nonrec t = Uri.t
  let cmp = (a, b) => Pervasives.compare(a, b)
})


module DateTime: {
  type t
  let now: unit => t
} = {
  type t = float
  let now = () => Js.Date.now()
}

module Value: {
  type t
  let string: string => t
} = {
  type t = String(string)

  let string = x => String(x)
}

module Fact = {
  type t = {
    id: Uri.t,
    stated_at: DateTime.t,
    entity_uri: Uri.t,
    field_uri: Uri.t,
    value: Value.t,
  }
}

module Entity = {
  type t = Belt.Map.t<Uri.t, Value.t, Uri_comparable.identity>
}

module EntityTable = {
  type t = Belt.Map.t<Uri.t, Entity.t, Uri_comparable.identity>
  let new = () => Belt.Map.make(~id=module(Uri_comparable))
}

module DB = {
  type t = {
    facts: array<Fact.t>,
    entities: EntityTable.t
  }

  let new = () => { facts: [], entities: EntityTable.new() }

  @send external push : (array<'a>, 'a) => unit = "push";
  let state = (db, fact) => {
    push(db.facts, fact);
    db
  }
}
