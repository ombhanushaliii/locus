import { Navigate, Route, Routes } from 'react-router-dom';
import { LocusProvider } from './state';
import { TopBar } from './components/TopBar';
import { AddressesPage } from './pages/AddressesPage';
import { SetupPage } from './pages/SetupPage';
import { MatchPage } from './pages/MatchPage';
import { LocalityPage } from './pages/LocalityPage';

export default function App() {
  return (
    <LocusProvider>
      <div className="app">
        <TopBar />
        <main className="app__main">
          <Routes>
            <Route path="/" element={<AddressesPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/match" element={<MatchPage />} />
            <Route path="/match/:localityId" element={<LocalityPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </LocusProvider>
  );
}
