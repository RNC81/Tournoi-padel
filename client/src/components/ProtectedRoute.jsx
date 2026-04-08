import { Navigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

// Redirige vers /admin/login si l'utilisateur n'est pas connecté
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-white/40">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
