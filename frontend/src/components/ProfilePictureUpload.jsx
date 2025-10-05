import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { X, UploadCloud, Loader2 } from "lucide-react";

const DEFAULT_PROFILE_IMAGE = "/default-profile.webp";

export default function ProfilePictureUpload({
  isOpen,
  onClose,
  currentImage,
  onUploadSuccess,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const API_BASE_URL = useMemo(
    () => import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api",
    []
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      return;
    }

    if (currentImage) {
      setPreviewUrl(currentImage);
    } else {
      setPreviewUrl(DEFAULT_PROFILE_IMAGE);
    }
  }, [isOpen, currentImage]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) {
    return null;
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (isUploading) return;

    if (!selectedFile) {
      toast.error("Please choose an image to upload first.");
      return;
    }

    const formData = new FormData();
    formData.append("profileimg", selectedFile);

    setIsUploading(true);
    try {
      const { data } = await axios.put(`${API_BASE_URL}/profile/update`, formData, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (!data?.success) {
        throw new Error(data?.message || "Failed to upload profile photo");
      }

      toast.success(data?.message || "Profile photo updated successfully!");
      if (data?.data) {
        window.dispatchEvent(
          new CustomEvent("profile:updated", { detail: data.data })
        );
      }
      onUploadSuccess?.(data.data);
      onClose?.();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Unable to upload profile photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200"
          aria-label="Close"
          disabled={isUploading}
        >
          <X className="h-5 w-5" />
        </button>

        <form onSubmit={handleUpload} className="space-y-6 p-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Update Profile Picture</h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose a new profile photo and click save to update your profile.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="relative h-40 w-40 overflow-hidden rounded-3xl border-4 border-white shadow-xl">
              <img 
                src={previewUrl || DEFAULT_PROFILE_IMAGE} 
                alt="Profile preview" 
                onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_PROFILE_IMAGE; }}
                className="h-full w-full object-cover" 
              />
            </div>

            <label
              htmlFor="profile-picture-upload-input"
              className="flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:from-green-600 hover:to-emerald-700"
            >
              <UploadCloud className="h-5 w-5" />
              {selectedFile ? "Choose another image" : "Choose image"}
              <input
                id="profile-picture-upload-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>

            {selectedFile && (
              <p className="text-xs text-gray-500">
                Selected file: <span className="font-medium text-gray-700">{selectedFile.name}</span>
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-700">Upload tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Use square images for the best fit.</li>
              <li>Maximum size 5MB. Accepted formats: JPG, PNG, GIF.</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 font-medium text-gray-600 transition hover:bg-gray-50"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 font-medium text-white shadow-lg transition hover:from-green-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isUploading}
            >
              {isUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Uploading...
                </span>
              ) : (
                "Save photo"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
