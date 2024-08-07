import { useEffect, useState, useRef, useCallback} from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import Pacha from "../pachadb.js";
import "./App.css";

const useObject = (uri) => {
  const [_, setTick] = useState(0);
  const onUpdate = useCallback(() => setTick(t => t+1), []);
  const objRef = useRef(Pacha.getObject(uri, {onUpdate }));
  return objRef.current
}

let user_id = Pacha.uri("linear", "user");
function App() {
  let user = useObject(user_id);
  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => {
          console.log(user.counter);
          user.counter = (user.counter || 0) + 1;
          user.save();
        }}>
          count is {user.counter}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
    </>
  );
}

export default App;
