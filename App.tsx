import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { StudentList } from './pages/StudentList';
import { AddStudent } from './pages/AddStudent';
import { StudentDetail } from './pages/StudentDetail';
import { TestResults } from './pages/TestResults';
import { ParentContacts } from './pages/ParentContacts';
import { CommunicationHistory } from './pages/CommunicationHistory';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<StudentList />} />
        <Route path="/add-student" element={<AddStudent />} />
        <Route path="/student/:id" element={<StudentDetail />} />
        <Route path="/student/:studentId/tests" element={<TestResults />} />
        <Route path="/student/:studentId/parents" element={<ParentContacts />} />
        <Route path="/student/:studentId/messages" element={<CommunicationHistory />} />
      </Routes>
    </Router>
  );
};

export default App;