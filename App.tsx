import React from 'react';
import { HashRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { StudentList } from './pages/StudentList';
import { AddStudent } from './pages/AddStudent';
import { StudentDetail } from './pages/StudentDetail';
import { TestResults } from './pages/TestResults';
import { ParentContacts } from './pages/ParentContacts';
import { CommunicationHistory } from './pages/CommunicationHistory';
import { BackupSettings } from './pages/BackupSettings';
import { MonthlyStatement } from './pages/MonthlyStatement';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AuthProvider, Protected, Authenticated, useAuth } from './components/AuthProvider';
import { Login } from './pages/Login';
import { Activate } from './pages/Activate';
import { StudentHome } from './pages/StudentHome';
import { AccountSettings } from './pages/AccountSettings';
import { StudentAccounts } from './pages/StudentAccounts';
import { TutorDataGate } from './components/TutorDataGate';
import { Connect } from './pages/Connect';

const ConnectRoute: React.FC = () => {
  const { account } = useAuth();
  return account?.role === 'TUTOR' ? <TutorDataGate><Connect /></TutorDataGate> : <Connect />;
};

const App: React.FC = () => {
  return (
    <AppErrorBoundary>
    <Router>
      <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/activate" element={<Activate />} />
        <Route path="/student-home" element={<Protected role="STUDENT"><StudentHome /></Protected>} />
        <Route path="/connect" element={<Authenticated><ConnectRoute /></Authenticated>} />
        <Route path="/student-account" element={<Protected role="STUDENT"><AccountSettings /></Protected>} />
        <Route element={<Protected role="TUTOR"><TutorDataGate><Outlet /></TutorDataGate></Protected>}>
          <Route path="/account" element={<AccountSettings />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/students" element={<StudentList />} />
          <Route path="/add-student" element={<AddStudent />} />
          <Route path="/student/:id" element={<StudentDetail />} />
          <Route path="/student/:studentId/tests" element={<TestResults />} />
          <Route path="/student/:studentId/parents" element={<ParentContacts />} />
          <Route path="/student/:studentId/messages" element={<CommunicationHistory />} />
          <Route path="/settings" element={<BackupSettings />} />
          <Route path="/student/:id/statement" element={<MonthlyStatement />} />
          <Route path="/student-accounts" element={<StudentAccounts />} />
        </Route>
      </Routes>
      </AuthProvider>
    </Router>
    </AppErrorBoundary>
  );
};

export default App;
