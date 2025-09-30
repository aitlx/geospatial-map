import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Search, Edit2, Trash2, X } from "lucide-react";

export default function YieldInput() {
  const [yields, setYields] = useState([]);
  const [filteredYields, setFilteredYields] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [crops, setCrops] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingYield, setEditingYield] = useState(null);
  const [formData, setFormData] = useState({
    barangay: "",
    crop: "",
    season: "",
    year: new Date().getFullYear(),
    total_yield: "",
    area: "",
    yield_per_hectare: "",
  });

  // Fetch yields from backend
  const fetchYields = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/barangay-yields"); // adjust endpoint if needed
      if (Array.isArray(res.data.data)) {
        setYields(res.data.data);
      } else {
        setYields([]);
      }
    } catch (err) {
      console.error("Error fetching yields:", err);
      setYields([]);
    }
  };

  // Fetch barangays for dropdown
  const fetchBarangays = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/barangays/dropdown");
      if (Array.isArray(res.data.data)) {
        setBarangays(res.data.data);
      } else {
        setBarangays([]);
      }
    } catch (err) {
      console.error("Error fetching barangays:", err);
      setBarangays([]);
    }
  };

  // Fetch crops for dropdown
  const fetchCrops = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/crops/dropdown");
      if (Array.isArray(res.data.data)) {
        setCrops(res.data.data);
      } else {
        setCrops([]);
      }
    } catch (err) {
      console.error("Error fetching crops:", err);
      setCrops([]);
    }
  };

  useEffect(() => {
    fetchYields();
    fetchBarangays();
    fetchCrops();
  }, []);

  // Filtering
  useEffect(() => {
    if (!Array.isArray(yields)) return;
    const filtered = yields.filter((yieldItem) => {
      const matchesSearch =
        yieldItem.barangay.toLowerCase().includes(searchTerm.toLowerCase()) ||
        yieldItem.crop.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeason = selectedSeason === "All" || yieldItem.season === selectedSeason;
      const matchesYear = selectedYear === "All" || yieldItem.year.toString() === selectedYear;
      return matchesSearch && matchesSeason && matchesYear;
    });
    setFilteredYields(filtered);
  }, [yields, searchTerm, selectedSeason, selectedYear]);

const handleSubmit = async (e) => {
  e.preventDefault();

  const payload = {
  barangay_id: selectedBarangay?.id,
  crop_id: selectedCrop?.id,       
  year: parseInt(formData.year),
  season: formData.season,
  total_yield: parseFloat(formData.total_yield),
  total_area_planted_ha: parseFloat(formData.area),
  yield_per_hectare: parseFloat(formData.yield_per_hectare),
};

  try {
    if (editingYield) {
      // Update existing yield
      await axios.put(`http://localhost:5000/api/barangay-yields/${editingYield.id}`, payload);
    } else {
      // Add new yield
      await axios.post("http://localhost:5000/api/barangay-yields", payload);
    }

    // Refresh the yields from backend
    fetchYields();
    resetForm();
  } catch (err) {
    console.error("Error saving yield:", err);
    alert("Failed to save yield. Check console for details.");
  }
};


  const resetForm = () => {
    setFormData({
      barangay: "",
      crop: "",
      season: "",
      year: new Date().getFullYear(),
      total_yield: "",
      area: "",
      yield_per_hectare: "",
    });
    setEditingYield(null);
    setShowModal(false);
  };

  const handleEdit = (yieldItem) => {
    setFormData(yieldItem);
    setEditingYield(yieldItem);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this yield record?")) {
      setYields(yields.filter((y) => y.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Yield Records
          </h1>
          <p className="text-gray-600 text-sm mt-1">Manage crop yield data across barangays</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Plus className="w-5 h-5" />
          Add Record
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search barangay or crop..."
              className="w-full pl-10 pr-4 h-12 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
          >
            <option value="All">All Seasons</option>
            <option value="Dry">Dry Season</option>
            <option value="Wet">Wet Season</option>
          </select>
          <select
            className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="All">All Years</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="2022">2022</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Barangay</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Crop</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Season</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Year</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Total Yield</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Area (ha)</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Yield/ha</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.isArray(filteredYields) && filteredYields.length > 0 ? (
                filteredYields.map((yieldItem) => (
                  <tr key={yieldItem.id} className="hover:bg-green-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{yieldItem.barangay}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{yieldItem.crop}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{yieldItem.season}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{yieldItem.year}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{yieldItem.total_yield?.toLocaleString()} kg</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{yieldItem.area}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{yieldItem.yield_per_hectare} kg/ha</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        yieldItem.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}>
                        {yieldItem.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(yieldItem)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(yieldItem.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    No yield records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {editingYield ? "Edit Yield Record" : "Add Yield Record"}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-white rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Barangay</label>
                  <select
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    value={selectedBarangay?.id?.toString() || ""}
                    onChange={(e) => {
                      const barangay = barangays.find((b) => b.id.toString() === e.target.value);
                      setSelectedBarangay(barangay || null);
                      setFormData({ ...formData, barangay: barangay?.name || "" });
                    }}
                    required
                  >
                    <option value="">Select Barangay</option>
                    {barangays.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                </div>

                <div className="form-control">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Crop</label>
<select
  className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
  value={selectedCrop && selectedCrop.id ? selectedCrop.id.toString() : ""}
  onChange={(e) => {
    const crop = crops.find(c => c.id && c.id.toString() === e.target.value);
    if (!crop) return;
    setSelectedCrop(crop);
    setFormData(prev => ({ ...prev, crop: crop.name }));
    console.log("Selected crop:", crop);
  }}
  required
>
  <option value="">Select Crop</option>
  {crops.map((c) => (
    <option key={c.id} value={c.id.toString()}>
      {c.name}
    </option>
  ))}
</select>






                </div>

                <div className="form-control">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Season</label>
                  <select
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                    required
                  >
                    <option value="">Select Season</option>
                    <option value="Dry">Dry Season</option>
                    <option value="Wet">Wet Season</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                  <input
                    type="number"
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Yield (kg)</label>
                  <input
                    type="number"
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    value={formData.total_yield}
                    onChange={(e) => setFormData({ ...formData, total_yield: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Area (hectares)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: parseFloat(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-control md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Yield per Hectare (kg/ha)</label>
                  <input
                    type="number"
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    value={formData.yield_per_hectare}
                    onChange={(e) => setFormData({ ...formData, yield_per_hectare: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
                >
                  {editingYield ? "Update" : "Add"} Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
