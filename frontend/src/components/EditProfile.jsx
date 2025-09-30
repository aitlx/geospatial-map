import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { User, Mail, Phone, Camera, Loader2, FileText, Shield } from "lucide-react";

export default function EditProfile({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    roleLabel: "",
    bio: "",
  });
  const [profilePreview, setProfilePreview] = useState(null);
  const [profileFile, setProfileFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const API_BASE_URL = useMemo(
    () => import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api",
    []
  );
  const ASSET_BASE_URL = useMemo(
    () => import.meta.env.VITE_ASSET_URL?.replace(/\/$/, "") || "http://localhost:5000",
    []
  );

  const roleLabels = useMemo(
    () => ({
      1: "Super Administrator",
      2: "Administrator",
      3: "Technician",
      4: "Farmer",
    }),
    []
  );

  const normalizeUser = useCallback(
    (rawUser) => {
      if (!rawUser) return null;
      return {
        firstName: rawUser.firstname || "",
        lastName: rawUser.lastname || "",
        email: rawUser.email || "",
        contactNumber: rawUser.contactnumber || "",
        roleLabel: roleLabels[rawUser.roleid] || rawUser.role || "User",
        bio: rawUser.bio || "",
        profileImage: rawUser.profileimg || null,
      };
    },
    [roleLabels]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/user/me`, {
          withCredentials: true,
        });

        if (!isMounted) return;

        if (data?.success) {
          const normalized = normalizeUser(data.data);
          if (normalized) {
            setFormData((prev) => ({
              ...prev,
              firstName: normalized.firstName,
              lastName: normalized.lastName,
              email: normalized.email,
              contactNumber: normalized.contactNumber,
              roleLabel: normalized.roleLabel,
              bio: normalized.bio,
            }));

            if (normalized.profileImage) {
              setProfilePreview(`${ASSET_BASE_URL}/uploads/${normalized.profileImage}`);
            }
          }
        } else {
          throw new Error(data?.message || "Failed to load profile details");
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error(error.response?.data?.message || "Unable to load profile details");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [API_BASE_URL, ASSET_BASE_URL, normalizeUser]);

  useEffect(() => {
    return () => {
      if (profilePreview && profilePreview.startsWith("blob:")) {
        URL.revokeObjectURL(profilePreview);
      }
    };
  }, [profilePreview]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (profilePreview && profilePreview.startsWith("blob:")) {
      URL.revokeObjectURL(profilePreview);
    }

    setProfileFile(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const formPayload = new FormData();
    if (formData.firstName.trim()) formPayload.append("firstName", formData.firstName.trim());
    if (formData.lastName.trim()) formPayload.append("lastName", formData.lastName.trim());
    if (formData.email.trim()) formPayload.append("email", formData.email.trim());
    if (formData.contactNumber.trim()) formPayload.append("contactNumber", formData.contactNumber.trim());
    if (profileFile) formPayload.append("profileimg", profileFile);

    setSaving(true);
    try {
      const { data } = await axios.put(`${API_BASE_URL}/profile/update`, formPayload, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (data?.success) {
        const successMessage = data.message || "Profile updated successfully!";

        if (data?.data) {
          window.dispatchEvent(
            new CustomEvent("profile:updated", { detail: data.data })
          );
        }

        if (onSuccess) {
          onSuccess(data.data, successMessage);
        } else {
          toast.success(successMessage);
        }
      } else {
        throw new Error(data?.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(error.response?.data?.message || "Unable to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Edit Profile
          </h1>
          <p className="text-gray-600 text-sm mt-1">Update your personal information</p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-8 text-center border-b border-gray-200">
          <div className="relative inline-block">
            {profilePreview ? (
              <img
                src={profilePreview}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover shadow-xl border-4 border-white"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-4xl font-bold shadow-xl">
                {formData.firstName?.charAt(0)?.toUpperCase() || "U"}
                {formData.lastName?.charAt(0)?.toUpperCase() || ""}
              </div>
            )}
            <label
              htmlFor="profile-upload"
              className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors border-2 border-green-500 cursor-pointer"
              title="Change photo"
            >
              <Camera className="w-5 h-5 text-green-600" />
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileChange}
              />
            </label>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mt-4">
            {[formData.firstName, formData.lastName].filter(Boolean).join(" ") || "Unnamed"}
          </h2>
          <p className="text-sm text-gray-600 mt-1">{formData.roleLabel || "User"}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="form-control">
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full h-12 pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    placeholder="Enter your first name"
                    required
                  />
                </div>
              </div>
              <div className="form-control">
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full h-12 pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    placeholder="Enter your last name"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-control">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="form-control">
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="tel"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                  placeholder="Enter your phone number"
                  required
                />
              </div>
            </div>

            <div className="form-control">
              <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
              <div className="relative">
                <FileText className="absolute left-4 top-4 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows="4"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all resize-none"
                  placeholder="Share a short introduction about yourself"
                />
              </div>
            </div>

            <div className="form-control">
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="text"
                  name="roleLabel"
                  value={formData.roleLabel}
                  disabled
                  className="w-full h-12 pl-12 pr-4 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}