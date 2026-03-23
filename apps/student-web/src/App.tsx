import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider } from './context/SidebarContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import InviteSignup from './pages/InviteSignup';
import Dashboard from './pages/Dashboard';
import MyTests from './pages/MyTests';
import TestAttempt from './pages/TestAttempt';
import CodingCompiler from './pages/CodingCompiler';
import TestResult from './pages/TestResult';
import MyCourses from './pages/MyCourses';
import CourseDetail from './pages/CourseDetail';
import PdfViewer from './pages/PdfViewer';
import Calendar from './pages/Calendar';
import Notifications from './pages/Notifications';
import ToastViewport from './components/ToastViewport';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invite" element={<InviteSignup />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tests" element={<MyTests />} />
        <Route path="attempt/:attemptId" element={<TestAttempt />} />
        <Route path="attempt/:attemptId/compiler" element={<CodingCompiler />} />
        <Route path="result/:attemptId" element={<TestResult />} />
        <Route path="courses" element={<MyCourses />} />
        <Route path="courses/:courseId" element={<CourseDetail />} />
        <Route path="pdf/:materialId" element={<PdfViewer />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppRoutes />
        <ToastViewport />
      </SidebarProvider>
    </AuthProvider>
  );
}
