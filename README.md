# PachaDB

Pacha is an embeddable, immutable, graph, edge database.

Pacha is an **edge database**. This means you can run it on edge providers like
Cloduflare, and it'll scale all over the world without you doing much.

Pacha is a **graph database**. This means that the data in Pacha is stored as
tiny little **facts** that form a huge graph of knowledge. Like this:

* Obi-wan is the master of Anakin
* Anakin is the master of Ahsoka

Obi-wan here is an **entity**. "Is the master of" is what we call a
**relation**, and then Anakin and Ahsoka are **values**. Notice that any entity
can be referenced as a value.

Pacha is an **embeddable database** and you can run it everywhere:

* on the browser
* on your backend with a file system or in-memory
* and even as a standalone 

Pacha uses **Datalog** instead of SQL for queries. Since the data in Pacha
forms a Graph, Datalog is a much easier way to query for it. For example:

`(?master is-master-of ?padawan)` returns all the masters with all their padawans.

But we can make much more complex queries, like this one. Here are trying to
find all the jedi masters with pupils that had encounters with the sith, where
the sith was Darth Maul, ONLY if the pupil has already become a jedi master too:

```
(?who has-rank jedi-master
 ?who is-master-of ?padawan
 ?padawan fought-in ?fight
 ?fight enemy-was darth-maul
 ?padawan has-rank jedi-master)
```

The equivalent SQL for this would involve several joins, and a lot more
writing! Something like this:

```
SELECT j.id, jp.id, sf.id from jedis as j  
 JOIN jedis_fights as jf ON jf.jedi_id = j.id
 JOIN jedis_masters as jm ON jm.master_id = j.id
 JOIN jedis_masters as jp ON jp.padawan_id = j.id
 JOIN siths_fights as sf ON sf.fight_id = jf.fight_id
 JOIN siths as s ON sf.sith_id = s.id
 WHERE j.has_rank = "jedi-master"
   AND e.has_name = "darth-maul"
   AND jp.has_rank = "jedi-master"
```


Pacha is an **immutable database**. This means that as you add information,
nothing is lost! This allows you to query your data over time.

In the datalog queries we did before, we can specify an `as-of` marker to go back in time and see the results of this query then.
