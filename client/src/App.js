import logo from './logo.svg';
import './App.css';
import Asset1 from './Assets/Asset_4.png';
import Asset2 from './Assets/Asset_5.png';
import Asset3 from './Assets/Asset_6_1.png';
import Asset4 from './Assets/Asset_7_1.png';

import Main from './components/Main';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <Main/>
      </header>
      <img src={Asset1} id="Asset1"/>
      <img src={Asset2} id="Asset2"/>
      {/* <img src={Asset3} id="Asset3"/>
      <img src={Asset4} id="Asset4"/> */}
      
    </div>
    
  );
}

export default App;
