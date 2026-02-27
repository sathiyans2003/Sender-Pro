import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import WhatsAppPage from './pages/WhatsAppPage';
import ContactsPage from './pages/ContactsPage';
import GroupsPage from './pages/GroupsPage';
import CampaignsPage from './pages/CampaignsPage';
import AutoReplyPage from './pages/AutoReplyPage';
import SchedulePage from './pages/SchedulePage';
import ContactFilterPage from './pages/ContactFilter';
import BulkSenderPage from './pages/BulkSender';
import PersonalizationPage from './pages/PersonalizationPage';
import GroupAutomationPage from './pages/GroupAutomationPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#7c3aed', fontSize: 18 }}>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="bulk" element={<BulkSenderPage />} />
        <Route path="personalize" element={<PersonalizationPage />} />
        <Route path="autoreply" element={<AutoReplyPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="group-automation" element={<GroupAutomationPage />} />
        <Route path="filter" element={<ContactFilterPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#13132a', color: '#f1f0ff', border: '1px solid #2a2a4a' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#13132a' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#13132a' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
