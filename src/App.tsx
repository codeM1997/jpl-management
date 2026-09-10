import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Join } from './pages/Join';
import { PendingApproval } from './pages/PendingApproval';
import { AdminDashboard } from './pages/AdminDashboard';
import { PlayerDashboard } from './pages/PlayerDashboard';
import { ManageMatch } from './pages/ManageMatch';

// A helper component to redirect users away from root based on role, or to set up initial admin
const RootRedirect = () => {
  const { currentUser, userData } = useAuth();

  if (!currentUser) return <Navigate to="/login" />;
  if (!userData) return null; // Let ProtectedRoute handle loading

  if (userData.role === 'pending') return <Navigate to="/pending" />;

  if (userData.role === 'admin' || userData.role === 'organizer') return <Navigate to="/admin" />;
  if (userData.role === 'player') return <Navigate to="/player" />;
  
  return <Navigate to="/pending" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/join" element={<Join />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<RootRedirect />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['pending']} />}>
            <Route path="/pending" element={<PendingApproval />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin', 'organizer']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/match/:matchId" element={<ManageMatch />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['player', 'admin', 'organizer']} />}>
            <Route path="/player" element={<PlayerDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
