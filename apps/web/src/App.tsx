import { Link, Navigate, Route, Routes } from "react-router-dom";
import { PeoplePage } from "./pages/PeoplePage";
import { MapPage } from "./pages/MapPage";

// A real nav pattern (responsive, tabs vs. drawer, etc.) is Phase 5's job. This is just
// enough to reach both pages while there are only two of them.
function App() {
  return (
    <div>
      <nav>
        <Link to="/people">People</Link> | <Link to="/map">Map</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/people" replace />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/map" element={<MapPage />} />
      </Routes>
    </div>
  );
}

export default App;
