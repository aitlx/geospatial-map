import React from 'react';
import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../src/pages/Login';
import Register from '../src/pages/Register';
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.withCredentials = true;


function App() {
  return (
    <> 
    <Routes>
      <Route path='/' element={<Login/>} />
       <Route path='/register' element={<Register/>} />
    </Routes>
    
    </>

  );
}

export default App;