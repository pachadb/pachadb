import React, { useState, useEffect, useCallback, useRef } from "react";
import DB from "pachadb";
import Datom from "pachadb/src/datom";

const SYNC_INTERVAL = 5000;
const SYNC_DEBOUNCE_TIME = 1000;

const generateClientId = () => {
  // const storedClientId = localStorage.getItem("todoAppClientId");
  // if (storedClientId) return storedClientId;

  const newClientId = "client-" + Math.random().toString(36).substr(2, 9);
  // localStorage.setItem("todoAppClientId", newClientId);
  return newClientId;
};

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const TodoApp = () => {
  const [clientId] = useState(generateClientId);
  const [db] = useState(() => DB.createDB());
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncQueue = useRef([]);

  const refreshState = useCallback(() => {
    const allDatoms = DB.datoms(db);
    const todoList = allDatoms
      .filter((datom) => Datom.attribute(datom) === "todo" && Datom.value(datom) !== null)
      .map((datom) => ({ id: Datom.entityId(datom), text: Datom.value(datom) }));
    setTodos(todoList);
    // Add any other state updates based on DB here
  }, [db]);

  const syncWithServer = useCallback(async () => {
    if (isSyncing) {
      syncQueue.current.push(true);
      return;
    }

    setIsSyncing(true);

    try {
      const unsyncedDatoms = DB.getUnsyncedDatoms(db);
      console.log("Syncing unsynced datoms:", unsyncedDatoms);
      const response = await fetch(`http://localhost:3000/sync?instance=todo-app&clientId=${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datoms: unsyncedDatoms }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { datoms, latestTxId, processedTxIds } = await response.json();
      console.log("Received synced datoms:", datoms);
      console.log("Latest server txId:", latestTxId);
      console.log("Processed transaction IDs:", processedTxIds);

      // Remove processed datoms from the local DB
      DB.removeTransactionIds(db, new Set(processedTxIds));

      // Apply received datoms to the local DB
      DB.addSyncedDatoms(db, datoms);

      setError(null);
      refreshState();
    } catch (err) {
      console.error("Sync error:", err);
      setError("Failed to sync with server. Please try again later.");
    } finally {
      setIsSyncing(false);
      if (syncQueue.current.length > 0) {
        syncQueue.current.shift();
        syncWithServer();
      }
    }
  }, [db, clientId, refreshState]);

  useEffect(() => {
    let timeoutId;

    const scheduleNextSync = () => {
      timeoutId = setTimeout(() => {
        if (!isSyncing) {
          syncWithServer().then(scheduleNextSync);
        } else {
          scheduleNextSync();
        }
      }, SYNC_INTERVAL);
    };

    scheduleNextSync();

    return () => clearTimeout(timeoutId);
  }, [syncWithServer, isSyncing]);

  const debouncedSync = useCallback(
    debounce(() => {
      if (!isSyncing) {
        syncWithServer();
      }
    }, SYNC_DEBOUNCE_TIME),
    [syncWithServer, isSyncing]
  );

  const addTodo = useCallback(() => {
    if (newTodo.trim()) {
      DB.insert(db, "todo", [{ todo: newTodo }]);
      setNewTodo("");
      refreshState();
      debouncedSync();
    }
  }, [db, newTodo, debouncedSync, refreshState]);

  const deleteTodo = useCallback(
    (id) => {
      DB.insert(db, "todo", [{ id, todo: null }]);
      refreshState();
      debouncedSync();
    },
    [db, debouncedSync, refreshState]
  );

  return (
    <div>
      <h1>Todo App</h1>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <input type="text" value={newTodo} onChange={(e) => setNewTodo(e.target.value)} placeholder="Enter a new todo" />
      <button onClick={addTodo}>Add Todo</button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            {todo.text}
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodoApp;
