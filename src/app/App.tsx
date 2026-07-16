import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CommunityBanner from './components/CommunityBanner';
import CatalogPage from './pages/CatalogPage';
import InstalledPage from './pages/InstalledPage';

const App: React.FC = () => (
  <div className="community-plugin-layout">
    {/* [SHARED] Do not remove — all community plugins must display the CommunityBanner */}
    <CommunityBanner />
    <div className="community-plugin-content">
      <Routes>
        <Route path="/" element={<Navigate to="catalog" replace />} />
        <Route path="catalog/*" element={<CatalogPage />} />
        <Route path="installed/*" element={<InstalledPage />} />
      </Routes>
    </div>
  </div>
);

export default App;
