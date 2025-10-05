import React from 'react';
import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../src/pages/Login';
import Home from './pages/Home';
import VerifyEmail from '../src/pages/verifyEmail'; 
import VerifyPhone from './pages/VerifyPhone';
import AdminAuthPortal from "./pages/AdminAuthPortal";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import GeospatialMap from "./pages/GeospatialMap";
import { API_URL } from './api';


const homeRoutes = [
  { path: '/Dashboard', view: 'dashboard' },
  { path: '/Yield-Inputs', view: 'yield-inputs' },
  { path: '/Market', view: 'market' },
  { path: '/geospatial-map', view: 'geospatial-map' },
  { path: '/Profile', view: 'profile' },
  { path: '/Edit-Profile', view: 'edit-profile' },
  { path: '/Settings', view: 'settings' },
  { path: '/Change-Password', view: 'change-password' },
];

const legacyHomeRedirects = [
  ['/Geospatial-Map', '/geospatial-map'],
  ['/user/Geospatial-Map', '/geospatial-map'],
  ['/user/geospatial-map', '/geospatial-map'],
];


import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.withCredentials = true;

function App() {
  return (
    <> 
      <Routes>
        <Route path='/' element={<GeospatialMap />} />
        <Route path='/login' element={<Login />} />
        <Route path='/verify-email' element={<VerifyEmail />} />
  <Route path='/verify-phone' element={<VerifyPhone />} />
        <Route path='/admin/login' element={<AdminAuthPortal />} />
        <Route path='/admin/dashboard' element={<AdminDashboard />} />
        {homeRoutes.map(({ path, view }) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute>
                <Home defaultView={view} />
              </ProtectedRoute>
            }
          />
        ))}
        {homeRoutes.map(({ path }) => {
          const lowerCasePath = path.toLowerCase()
          if (lowerCasePath === path) return null

          return (
            <Route
              key={`${path}-redirect`}
              path={lowerCasePath}
              element={<Navigate to={path} replace />}
            />
          )
        })}
        {legacyHomeRedirects.map(([legacyPath, targetPath]) => (
          <Route
            key={`legacy-${legacyPath}`}
            path={legacyPath}
            element={<Navigate to={targetPath} replace />}
          />
        ))}
        <Route path='/Home' element={<Navigate to='/Dashboard' replace />} />
        <Route path='/home' element={<Navigate to='/Dashboard' replace />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </>
  );
}

export default App;
