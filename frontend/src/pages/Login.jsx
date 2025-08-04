import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prevData) => ({
      ...prevData,
      [e.target.name]: e.target.value,
    }));
  };

  const loginUser = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', formData);

      toast.success(response.data.message || "Login successful!");

      // navigate to home after a short delay
      setTimeout(() => {
        navigate('/Home.jsx');
      }, 1500);
    } catch (error) {
      if (error.response && error.response.data && error.response.data.err) {
        toast.error(error.response.data.err);
      } else {
        toast.error("An unexpected error occurred.");
      }
    }
  };

  return (
    <div>
      <ToastContainer />
      <h2>Login</h2>
      <form onSubmit={loginUser}>
        <div>
          <label>Email</label><br />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
          />
        </div>
        <br />
        <div>
          <label>Password</label><br />
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />
        </div>
        <br />
        <button type="submit">Log In</button>
      </form>

      <p style={{ marginTop: '10px' }}>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
