import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { API_URL } from '../api';

export default function ResetPassword(){
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedEmail = location.state?.email || '';
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(()=>{
    const t = searchParams.get('token') || '';
    if(t) setToken(t);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try{
      const resp = await axios.patch(`${API_URL}/auth/reset-password`, { token, newPassword }, { withCredentials: true });
      toast.success(resp.data?.message || 'Password updated');
      setTimeout(()=> navigate('/login'), 1200);
    }catch(err){
      const msg = err?.response?.data?.message || err?.message || 'Failed to reset password';
      toast.error(msg);
    }finally{ setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h3 className="text-lg font-semibold mb-2">Reset password</h3>
  <p className="text-sm text-slate-500 mb-4">Open the reset link you received in email to proceed and choose a new password.</p>

        {(!token) ? (
          <div className="mb-6 rounded-md border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
            <p className="mb-2">A password reset link was requested for <span className="font-semibold">{redirectedEmail || 'your account'}</span>.</p>
            <p className="text-xs">Check your inbox and open the link to proceed. If you didn't receive an email, request a new link from the Forgot Password page.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="text-xs font-medium text-slate-700">New password</label>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
              <Lock className="h-4 w-4 text-teal-500" />
              <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required className="flex-1 bg-white/95 outline-none text-sm text-slate-800 placeholder-slate-400 caret-teal-600" placeholder="New password" />
              <button type="button" onClick={() => setShowPassword(s => !s)} className="flex h-6 w-6 items-center justify-center rounded-full text-teal-500 transition hover:bg-teal-50" aria-label="Toggle new password visibility">
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            <label className="text-xs font-medium text-slate-700">Confirm new password</label>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
              <Lock className="h-4 w-4 text-teal-500" />
              <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required className="flex-1 bg-white/95 outline-none text-sm text-slate-800 placeholder-slate-400 caret-teal-600" placeholder="Confirm password" />
              <button type="button" onClick={() => setShowConfirm(s => !s)} className="flex h-6 w-6 items-center justify-center rounded-full text-teal-500 transition hover:bg-teal-50" aria-label="Toggle confirm password visibility">
                {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            <button type="submit" disabled={loading || !token} className="w-full rounded-xl bg-teal-500 text-white py-2 text-sm font-semibold">
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
