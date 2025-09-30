import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    gender: '',
    birthday: '',
    contactNumber: '',
    password: '',
    confirmPassword: '',
    roleID: 3 // default roleID for regular user / tehcnician
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await axios.post('http://localhost:5000/api/auth/register', formData);
      if (data.error) toast.error(data.error);
      else {
        toast.success("Registered successfully! Check your email for verification code.");
        // redirect to verification page and pass email
        setTimeout(() => navigate('/verify-email', { state: { email: formData.email } }), 2000);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Registration failed. Try again.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4 overflow-hidden">
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false} 
        newestOnTop 
        closeOnClick 
        pauseOnHover 
        draggable 
        className="mt-16"
      />

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="wheat" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="2" fill="#16a34a"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wheat)"/>
        </svg>
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4M9 7l6 3"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            GeoAgriTech
          </h1>
          <p className="text-gray-600 text-sm mt-1">Geospatial Agriculture Intelligence</p>
        </div>

        {/* Registration Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Technician Registration</h2>
              <p className="text-gray-600 text-sm">Request access to geospatial analytics platform</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* First & Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label pb-2">
                    <span className="label-text font-medium text-gray-700">First Name</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="John"
                      className="w-full bg-white/50 backdrop-blur-sm border border-gray-100 focus:border-green-400 focus:bg-white rounded-2xl h-12 pl-12 transition-all duration-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:shadow-lg focus:shadow-green-100"
                      required
                    />
                    <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label pb-2">
                    <span className="label-text font-medium text-gray-700">Last Name</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Doe"
                      className="w-full bg-white/50 backdrop-blur-sm border border-gray-100 focus:border-green-400 focus:bg-white rounded-2xl h-12 pl-12 transition-all duration-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:shadow-lg focus:shadow-green-100"
                      required
                    />
                    <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Email */}
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

              {/* Gender & Birthday */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label pb-2">
                    <span className="label-text font-medium text-gray-700">Gender</span>
                  </label>
                  <div className="relative">
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full bg-white/50 backdrop-blur-sm border border-gray-100 focus:border-green-400 focus:bg-white rounded-2xl h-12 pl-12 pr-4 transition-all duration-200 text-gray-900 focus:outline-none focus:shadow-lg focus:shadow-green-100 appearance-none"
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                    <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label pb-2">
                    <span className="label-text font-medium text-gray-700">Birthday</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      name="birthday"
                      value={formData.birthday}
                      onChange={handleChange}
                      className="w-full bg-white/50 backdrop-blur-sm border border-gray-100 focus:border-green-400 focus:bg-white rounded-2xl h-12 pl-12 pr-4 transition-all duration-200 text-gray-900 focus:outline-none focus:shadow-lg focus:shadow-green-100"
                      required
                    />
                    <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-5 4h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Contact Number */}
              <div className="form-control">
                <label className="label pb-2">
                  <span className="label-text font-medium text-gray-700">Contact Number</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    placeholder="09XXXXXXXXX"
                    className="w-full bg-white/50 backdrop-blur-sm border border-gray-100 focus:border-green-400 focus:bg-white rounded-2xl h-12 pl-12 transition-all duration-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:shadow-lg focus:shadow-green-100"
                    required
                  />
                  <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                </div>
              </div>

              {/* Password */}
              <div className="form-control">
                <label className="label pb-2">
                  <span className="label-text font-medium text-gray-700">Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create a strong password"
                    className="w-full bg-white/50 backdrop-blur-sm border border-gray-100 focus:border-green-400 focus:bg-white rounded-2xl h-12 pl-12 pr-12 transition-all duration-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:shadow-lg focus:shadow-green-100"
                    required
                  />
                  <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242"/>
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="form-control">
                <label className="label pb-2">
                  <span className="label-text font-medium text-gray-700">Confirm Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className="w-full bg-white/50 backdrop-blur-sm border border-gray-100 focus:border-green-400 focus:bg-white rounded-2xl h-12 pl-12 pr-20 transition-all duration-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:shadow-lg focus:shadow-green-100"
                    required
                  />
                  <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  
                  {/* Check icon - shows green when passwords match */}
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <svg className="absolute right-12 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                  
                  {/* Eye icon for password visibility */}
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showConfirm ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 711.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242"/>
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      )}
                    </svg>
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1 ml-1">Passwords don't match</p>
                )}
              </div>

              {/* Terms Checkbox */}
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm border-gray-300 [--chkbg:theme(colors.green.500)] [--chkfg:white] rounded"
                    required
                  />
                  <span className="label-text text-gray-600 text-xs">
                    I agree to the{" "}
                    <Link to="/terms" className="text-green-600 hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-green-600 hover:underline">
                      Privacy Policy
                    </Link>
                  </span>
                </label>
              </div>

              {/* Register Button */}
              <div className="form-control mt-8">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-none text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                      </svg>
                      Create Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Login Section */}
          <div className="px-8 py-6 bg-gradient-to-r from-green-50 to-emerald-50 border-t border-gray-100">
            <p className="text-center text-sm text-gray-600">
              Already have technician access?{" "}
              <Link 
                to="/" 
                className="font-semibold text-green-600 hover:text-green-700 transition-colors duration-200"
              >
                Log in here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-gray-500">
          <p>© 2024 GeoAgriTech. Geospatial intelligence for precision agriculture.</p>
        </div>
      </div>
    </div>
  );
}