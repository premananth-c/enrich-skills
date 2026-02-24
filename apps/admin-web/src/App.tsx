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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="questions" element={<Questions />} />
          <Route path="questions/new" element={<QuestionForm />} />
          <Route path="questions/:id/edit" element={<QuestionForm />} />
          <Route path="tests" element={<Tests />} />
          <Route path="tests/new" element={<TestForm />} />
          <Route path="tests/:id" element={<TestDetail />} />
          <Route path="tests/:id/edit" element={<TestForm />} />
          <Route path="batches" element={<Batches />} />
          <Route path="batches/new" element={<BatchForm />} />
          <Route path="batches/:id" element={<BatchDetail />} />
          <Route path="batches/:id/edit" element={<BatchForm />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/new" element={<CourseForm />} />
          <Route path="courses/:id" element={<CourseDetail />} />
          <Route path="courses/:id/edit" element={<CourseForm />} />
          <Route path="reports" element={<Reports />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
