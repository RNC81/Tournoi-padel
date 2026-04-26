import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './utils/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import AdminLayout from './components/admin/AdminLayout';

// ── Pages publiques ────────────────────────────────────────────────────────────
import HomePage       from './pages/HomePage';
import RegisterPage   from './pages/RegisterPage';
import GuestHomePage  from './pages/GuestHomePage';

// ── Pages admin ────────────────────────────────────────────────────────────────
import AdminLoginPage       from './pages/AdminLoginPage';
import AdminDashboardPage   from './pages/AdminDashboardPage';
import AdminTournamentPage  from './pages/AdminTournamentPage';
import AdminTeamsPage       from './pages/AdminTeamsPage';
import AdminGroupsPage      from './pages/AdminGroupsPage';
import AdminBracketPage     from './pages/AdminBracketPage';
import AdminConsolantePage  from './pages/AdminConsolantePage';

// Wrapper pour les pages publiques (avec Navbar)
function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Pages publiques (avec Navbar) ── */}
          <Route path="/"           element={<PublicLayout><HomePage /></PublicLayout>} />
          <Route path="/inscription" element={<PublicLayout><RegisterPage /></PublicLayout>} />
          <Route path="/tournoi"    element={<PublicLayout><GuestHomePage /></PublicLayout>} />

          {/* ── Admin login (sans layout) ── */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* ── Admin (sidebar layout, toutes les pages protégées) ── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index                  element={<AdminDashboardPage />} />
            <Route path="tournament"      element={<AdminTournamentPage />} />
            <Route path="teams"           element={<AdminTeamsPage />} />
            <Route path="groups"          element={<AdminGroupsPage />} />
            <Route path="bracket"         element={<AdminBracketPage />} />
            <Route path="bracket/consolante" element={<AdminConsolantePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
