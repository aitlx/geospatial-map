import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false
  });
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const loginUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        formData,
        { withCredentials: true }
      );
      toast.success(response.data.message || "Login successful!");
      setTimeout(() => {
        navigate("/home");
      }, 1500);
    } catch (error) {
      let msg = "An unexpected error occurred.";

      if (error.response) {
        const data = error.response.data;

        // Handle different formats gracefully
        if (typeof data === "string") {
          msg = data;
        } else if (data?.message) {
          msg = data.message;
        } else if (data?.err) {
          msg = data.err;
        } else if (data?.error) {
          msg = data.error;
        } else {
          msg = JSON.stringify(data);
        }
      } else if (error.request) {
        msg = "No response from server. Check your network.";
      } else {
        msg = error.message;
      }

      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4 overflow-hidden">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover className="mt-16" />
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4M9 7l6 3"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">GeoAgriTech</h1>
          <p className="text-gray-600 text-sm mt-1">Geospatial Agriculture Intelligence</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Technician Portal</h2>
              <p className="text-gray-600 text-sm">Access geospatial analysis & recommendations</p>
            </div>
            <form onSubmit={loginUser} className="space-y-6">
              <div className="form-control">
                <label className="label pb-2">
                  <span className="label-text font-medium text-gray-700">Email Address</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="technician@geoagritech.com"
                    className="w-full bg-white/50 backdrop-blur-sm border border-gray-100 focus:border-green-400 focus:bg-white rounded-2xl h-12 pl-12 transition-all duration-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:shadow-lg focus:shadow-green-100"
                    required
                  />
                  <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
              </div>
              <div className="form-control">
                <label className="label pb-2">
                  <span className="label-text font-medium text-gray-700">Password</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your secure password"
                    className="w-full bg-white/50 backdrop-blur-sm border border-gray-100 focus:border-green-400 focus:bg-white rounded-2xl h-12 pl-12 transition-all duration-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:shadow-lg focus:shadow-green-100"
                    required
                  />
                  <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
              </div>
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    className="checkbox checkbox-sm border-gray-300 [--chkbg:theme(colors.green.500)] [--chkfg:white] rounded"
                  />
                  <span className="label-text text-gray-600 text-sm">Remember me for 30 days</span>
                </label>
              </div>
              <div className="form-control mt-8">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="btn h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-none text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Logging In...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                      </svg>
                      Log In
                    </>
                  )}
                </button>
              </div>
            </form>
            <div className="text-center mt-6">
              <Link to="/forgot-password" className="text-sm text-gray-600 hover:text-green-600 transition-colors duration-200">
                Forgot your password?
              </Link>
            </div>
          </div>
          <div className="px-8 py-6 bg-gradient-to-r from-green-50 to-emerald-50 border-t border-gray-100">
            <p className="text-center text-sm text-gray-600">
              Need a technician account?{" "}
              <Link 
                to="/register" 
                className="font-semibold text-green-600 hover:text-green-700 transition-colors duration-200"
              >
                Request access
              </Link>
            </p>
          </div>
        </div>
        <div className="text-center mt-8 text-xs text-gray-500">
          <p>© 2024 GeoAgriTech. Geospatial intelligence for precision agriculture.</p>
        </div>
      </div>
    </div>
  );
}
