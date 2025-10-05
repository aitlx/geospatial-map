import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { User, Mail, Phone, Camera, Loader2, FileText, Shield } from "lucide-react";

const DEFAULT_PROFILE_IMAGE = "/default-profile.webp";

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
    if (formData.firstName.trim()) {
      formPayload.append("firstName", formData.firstName.trim());
    }
    if (formData.lastName.trim()) {
      formPayload.append("lastName", formData.lastName.trim());
    }
    if (formData.email.trim()) {
      formPayload.append("email", formData.email.trim());
    }
    if (formData.contactNumber.trim()) {
      formPayload.append("contactNumber", formData.contactNumber.trim());
    }
    formPayload.append("bio", formData.bio.trim());
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

  const displayName = [formData.firstName, formData.lastName].filter(Boolean).join(" ") || "Unnamed";
  const initials = `${formData.firstName?.charAt(0) || ""}${formData.lastName?.charAt(0) || ""}`.trim().toUpperCase() || "U";
  const roleDisplay = formData.roleLabel || "User";

  return (
    <div className="space-y-8">
      <ToastContainer position="top-right" autoClose={3000} theme="light" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600/80">Account settings</p>
          <h1 className="mt-2 text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-700">Edit profile</h1>
          <p className="mt-1 text-sm text-slate-500">Update your personal information and keep your profile fresh.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-emerald-100/70 bg-white/95 shadow-lg shadow-emerald-900/5">
        <div className="border-b border-emerald-100/60 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent p-8">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-emerald-400/15 blur-2xl" aria-hidden="true"></div>
              {profilePreview ? (
                <img
                  src={profilePreview}
                  alt="Profile preview"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                  }}
                  className="relative h-32 w-32 rounded-2xl border border-white/80 bg-white object-cover shadow-xl shadow-emerald-500/20"
                />
              ) : (
                <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border border-white/70 bg-gradient-to-br from-emerald-500 to-teal-500 text-3xl font-semibold text-white shadow-xl shadow-emerald-500/30">
                  {initials || "U"}
                </div>
              )}
              <label
                htmlFor="profile-upload"
                className="absolute bottom-3 right-3 inline-flex items-center justify-center rounded-xl border border-white/70 bg-white/90 p-2 text-sm font-medium text-emerald-600 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-white"
                title="Change photo"
              >
                <Camera className="h-4 w-4" />
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfileChange}
                />
              </label>
            </div>

            <div className="space-y-2 text-slate-700 sm:space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">{displayName}</h2>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-emerald-700">
                <Shield className="h-4 w-4" />
                {roleDisplay}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600/80">First name</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400/80" />
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-emerald-100 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 shadow-inner shadow-emerald-100 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Enter your first name"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600/80">Last name</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400/80" />
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-emerald-100 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 shadow-inner shadow-emerald-100 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Enter your last name"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600/80">Email address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400/80" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-emerald-100 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 shadow-inner shadow-emerald-100 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600/80">Phone number</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400/80" />
                <input
                  type="tel"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-emerald-100 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 shadow-inner shadow-emerald-100 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Enter your phone number"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600/80">Bio</label>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-emerald-400/80" />
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                className="w-full rounded-xl border border-emerald-100 bg-white pl-11 pr-4 pt-3 text-sm font-medium text-slate-900 shadow-inner shadow-emerald-100 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="Share a short introduction about yourself"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600/80">Role</label>
            <div className="relative">
              <Shield className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400/80" />
              <input
                type="text"
                name="roleLabel"
                value={roleDisplay}
                disabled
                className="h-11 w-full rounded-xl border border-emerald-100 bg-emerald-50/40 pl-11 pr-4 text-sm font-medium text-slate-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-emerald-100/60 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}