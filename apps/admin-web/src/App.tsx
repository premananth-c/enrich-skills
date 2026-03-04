import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Questions from './pages/Questions';
import QuestionForm from './pages/QuestionForm';
import Tests from './pages/Tests';
import TestDetail from './pages/TestDetail';
import TestForm from './pages/TestForm';
import Students from './pages/Students';
import Batches from './pages/Batches';
import BatchForm from './pages/BatchForm';
import BatchDetail from './pages/BatchDetail';
import Courses from './pages/Courses';
import CourseForm from './pages/CourseForm';
import CourseDetail from './pages/CourseDetail';
import Reports from './pages/Reports';
import ToastViewport from './components/ToastViewport';
import ManageUsers from './pages/ManageUsers';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ModuleRoute({ moduleKey, access = 'view', children }: { moduleKey: string; access?: 'view' | 'edit'; children: React.ReactNode }) {
  const { canView, canEdit } = useAuth();
  const allowed = access === 'edit' ? canEdit(moduleKey) : canView(moduleKey);
  if (!allowed) {
    return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>You dont have permission to view this page.</div>;
  }
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) {
    return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>You dont have permission to view this page.</div>;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="students" element={<ModuleRoute moduleKey="students"><Students /></ModuleRoute>} />
            <Route path="questions" element={<ModuleRoute moduleKey="questions"><Questions /></ModuleRoute>} />
            <Route path="questions/new" element={<ModuleRoute moduleKey="questions" access="edit"><QuestionForm /></ModuleRoute>} />
            <Route path="questions/:id/edit" element={<ModuleRoute moduleKey="questions" access="edit"><QuestionForm /></ModuleRoute>} />
            <Route path="tests" element={<ModuleRoute moduleKey="tests"><Tests /></ModuleRoute>} />
            <Route path="tests/new" element={<ModuleRoute moduleKey="tests" access="edit"><TestForm /></ModuleRoute>} />
            <Route path="tests/:id" element={<ModuleRoute moduleKey="tests"><TestDetail /></ModuleRoute>} />
            <Route path="tests/:id/edit" element={<Navigate to=".." replace />} />
            <Route path="batches" element={<ModuleRoute moduleKey="batches"><Batches /></ModuleRoute>} />
            <Route path="batches/new" element={<ModuleRoute moduleKey="batches" access="edit"><BatchForm /></ModuleRoute>} />
            <Route path="batches/:id" element={<ModuleRoute moduleKey="batches"><BatchDetail /></ModuleRoute>} />
            <Route path="batches/:id/edit" element={<ModuleRoute moduleKey="batches" access="edit"><BatchForm /></ModuleRoute>} />
            <Route path="courses" element={<ModuleRoute moduleKey="courses"><Courses /></ModuleRoute>} />
            <Route path="courses/new" element={<ModuleRoute moduleKey="courses" access="edit"><CourseForm /></ModuleRoute>} />
            <Route path="courses/:id" element={<ModuleRoute moduleKey="courses"><CourseDetail /></ModuleRoute>} />
            <Route path="courses/:id/edit" element={<ModuleRoute moduleKey="courses" access="edit"><CourseForm /></ModuleRoute>} />
            <Route path="reports" element={<ModuleRoute moduleKey="reports"><Reports /></ModuleRoute>} />
            <Route path="manage-users" element={<SuperAdminRoute><ManageUsers /></SuperAdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastViewport />
      </>
    </AuthProvider>
  );
}
