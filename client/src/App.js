import logo from "./logo.svg";
import "./App.css";
import Asset1 from "./Assets/Asset_4.png";
import Asset2 from "./Assets/Asset_5.png";

import Main from "./components/Main";

function App() {
  return (
    <div className="App">
      <img src={Asset1} id="Asset1"/>
      <img src={Asset2} id="Asset2"/>
      <div>
        <header
          className="App-header"
        >
          <Main />
        </header>
      </div>
    </div>
  );
}

export default App;
