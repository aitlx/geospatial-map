import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Mail } from 'lucide-react';
import { API_URL } from '../api';

export default function ForgotPassword(){
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const portal = location.state?.portal || 'technician';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try{
      const resp = await axios.post(`${API_URL}/auth/forgot-password`, { email, portal }, { withCredentials: true });
      toast.success(resp.data?.message || 'Password reset link sent. Check your email.');
      navigate('/reset-password', { state: { email } });
    }catch(err){
      const status = err?.response?.status
      if (status === 404) {
        toast.error('Account not found for that email.');
      } else {
        const msg = err?.response?.data?.message || err?.message || 'Failed to send reset link';
        toast.error(msg);
      }
    }finally{
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h3 className="text-lg font-semibold mb-2">Forgot password</h3>
        <p className="text-sm text-slate-500 mb-4">Enter your account email and we'll send a password reset link.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="text-xs font-medium text-slate-700">Email</label>
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <Mail className="h-4 w-4 text-teal-500" />
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="flex-1 bg-white outline-none text-sm text-slate-800 placeholder-slate-400 caret-teal-600" placeholder="you@example.com" />
          </div>

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-teal-500 text-white py-2 text-sm font-semibold">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      </div>
    </div>
  );
}