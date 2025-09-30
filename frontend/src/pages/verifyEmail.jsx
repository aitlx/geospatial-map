import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const userEmail = location.state?.email || '';

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setCode(value.slice(0, 6));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Please enter the 6-digit code.');
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await axios.patch('/api/auth/verify-code', {
        email: userEmail,
        code
      });
      if (data.error) toast.error(data.error);
      else {
        toast.success('Email verified successfully!');
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Verification failed';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await axios.post('/api/auth/send-code', { email: userEmail });
      toast.success('Verification code resent to your email');
      setResendCooldown(60);
    } catch (err) {
      toast.error('Failed to resend code. Try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Verify Your Email</h2>
          <p className="text-gray-600 text-sm mb-2 text-center">
            Enter the 6-digit code we sent to your email:
          </p>
          <p className="text-gray-800 text-sm mb-6 text-center font-medium">{userEmail}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={handleChange}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full pl-4 pr-4 h-12 rounded-2xl border border-gray-200 bg-white/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:bg-white focus:shadow-lg focus:shadow-green-100 transition-all text-center tracking-widest text-lg"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-70"
            >
              {isLoading ? <span className="loading loading-spinner loading-sm"></span> : 'Verify'}
            </button>
          </form>

          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="mt-4 w-full h-12 border border-green-500 text-green-600 rounded-2xl hover:bg-green-50 font-semibold transition-colors disabled:opacity-50"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>
      </div>
    </div>
  );
}
