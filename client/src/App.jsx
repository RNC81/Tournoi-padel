import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './utils/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Pages publiques
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import GuestHomePage from './pages/GuestHomePage';

// Pages admin
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

// Layout pour les pages publiques (avec Navbar)
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
          <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
          <Route path="/inscription" element={<PublicLayout><RegisterPage /></PublicLayout>} />
          <Route path="/tournoi" element={<PublicLayout><GuestHomePage /></PublicLayout>} />

          {/* ── Admin (sans Navbar publique) ── */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
