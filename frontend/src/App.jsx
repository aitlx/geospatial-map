import React from 'react';
import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../src/pages/Login';
import Register from '../src/pages/Register';
import Home from './pages/Home';
import VerifyEmail from '../src/pages/verifyEmail'; 


import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.withCredentials = true;

function App() {
  return (
    <> 
      <Routes>
        <Route path='/' element={<Login />} />
        <Route path='/register' element={<Register />} />
        <Route path='/verify-email' element={<VerifyEmail />} />
         <Route path='/home' element={<Home />} />
        <Route path='*' element={<Navigate to='/' />} />
      </Routes>
    </>
  );
}

export default App;
