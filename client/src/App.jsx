import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './utils/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages publiques
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';

// Pages admin
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

// Pages publiques (scores/brackets) — à créer dans les prochaines sessions
// import GroupsPage from './pages/GroupsPage';
// import BracketPage from './pages/BracketPage';
// import ConsolationPage from './pages/ConsolationPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Pages publiques ── */}
          <Route path="/" element={<HomePage />} />
          <Route path="/inscription" element={<RegisterPage />} />

          {/* Routes publiques à implémenter : groupes, bracket, consolante */}
          {/* <Route path="/groupes" element={<GroupsPage />} /> */}
          {/* <Route path="/bracket" element={<BracketPage />} /> */}
          {/* <Route path="/consolante" element={<ConsolationPage />} /> */}

          {/* ── Admin ── */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          {/* Routes admin à implémenter */}
          {/* <Route path="/admin/groupes" element={<ProtectedRoute><AdminGroupsPage /></ProtectedRoute>} /> */}
          {/* <Route path="/admin/bracket" element={<ProtectedRoute><AdminBracketPage /></ProtectedRoute>} /> */}
          {/* <Route path="/admin/equipes" element={<ProtectedRoute><AdminTeamsPage /></ProtectedRoute>} /> */}
          {/* <Route path="/admin/admins" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} /> */}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
