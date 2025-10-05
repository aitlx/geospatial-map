import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'
import { BrowserRouter as Router  } from 'react-router-dom';
import { PreferencesProvider } from './context/PreferencesContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PreferencesProvider>
      <Router>
        <App />
      </Router>
    </PreferencesProvider>
  </React.StrictMode>
);