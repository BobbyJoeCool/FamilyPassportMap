import { Navigate, Route, Routes } from "react-router-dom";
import { PeoplePage } from "./pages/PeoplePage";

// Map/Compare/List routes land in Phases 2-4; navigation between them gets a real
// pattern in Phase 5. For now People is the only page, so "/" just redirects there.
function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/people" replace />} />
      <Route path="/people" element={<PeoplePage />} />
    </Routes>
  );
}

export default App;
