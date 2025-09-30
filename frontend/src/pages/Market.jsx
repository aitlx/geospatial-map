import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, X, TrendingUp } from "lucide-react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Market() {
  const [data, setData] = useState({
    prices: [],
    barangays: [],
    crops: []
  });
  
  const [filters, setFilters] = useState({
    searchTerm: "",
    season: "All",
    year: "All"
  });
  
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    barangay: "",
    crop: "",
    season: "",
    year: new Date().getFullYear(),
    price_per_kg: "",
  });

  axios.defaults.withCredentials = true;

  const createAxiosRequest = async (method, url, requestData = null) => {
    try {
      const config = {
        method: method.toLowerCase(),
        url,
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (method.toLowerCase() !== 'get' && method.toLowerCase() !== 'delete' && requestData) {
        config.data = requestData;
      }

      const response = await axios(config);
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
      } else if (error.response?.status === 403) {
        const message = error.response?.data?.message || '';
        if (message.includes('verify your email')) {
          toast.error("Please verify your email first.");
        } else {
          toast.error("Access denied. Insufficient permissions.");
        }
      } else if (error.response?.status >= 500) {
        toast.error("Server error. Please try again later.");
      }
      throw error;
    }
  };

  const filteredPrices = useMemo(() => {
    if (!Array.isArray(data.prices)) return [];
    
    return data.prices.filter((price) => {
      const matchesSearch = !filters.searchTerm || 
        (price.barangay?.name || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (price.crop?.name || '').toLowerCase().includes(filters.searchTerm.toLowerCase());
      
      const matchesSeason = filters.season === "All" || price.season === filters.season;
      const matchesYear = filters.year === "All" || price.year?.toString() === filters.year;

      return matchesSearch && matchesSeason && matchesYear;
    });
  }, [data.prices, filters]);

  const getAvailableYears = () => {
    if (!Array.isArray(data.prices)) return [new Date().getFullYear()];
    const years = [...new Set(data.prices.map(price => price.year).filter(Boolean))].sort((a, b) => b - a);
    return years.length > 0 ? years : [new Date().getFullYear()];
  };

  const fetchAllData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      const [pricesRes, barangaysRes, cropsRes] = await Promise.all([
        createAxiosRequest('get', "http://localhost:5000/api/barangay-crop-prices"),
        createAxiosRequest('get', "http://localhost:5000/api/barangays/dropdown"),
        createAxiosRequest('get', "http://localhost:5000/api/crops/dropdown")
      ]);

      const barangays = barangaysRes.data?.success && Array.isArray(barangaysRes.data.data) 
        ? barangaysRes.data.data 
        : [];

      const crops = cropsRes.data?.success && Array.isArray(cropsRes.data.data)
        ? cropsRes.data.data
        : [];

      let prices = [];
      if (pricesRes.data?.success && Array.isArray(pricesRes.data.data)) {
        prices = pricesRes.data.data.map(price => ({
          ...price,
          id: price.id || price.price_id,
          barangay: barangays.find(b => b.id === price.barangay_id),
          crop: crops.find(c => c.id === price.crop_id)
        }));
      }

      setData({ prices, barangays, crops });

    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        toast.error("Failed to fetch data");
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (submitting) return;
    
    if (!selectedBarangay?.id) {
      toast.error("Please select a barangay");
      return;
    }
    
    if (!selectedCrop?.id) {
      toast.error("Please select a crop");
      return;
    }
    
    if (!formData.season) {
      toast.error("Please select a season");
      return;
    }

    const year = parseInt(formData.year);
    const price = parseFloat(formData.price_per_kg);

    if (isNaN(year) || year < 2000 || year > new Date().getFullYear() + 10) {
      toast.error("Please enter a valid year");
      return;
    }

    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    const payload = {
      barangay_id: parseInt(selectedBarangay.id),
      crop_id: parseInt(selectedCrop.id),
      season: formData.season.trim(),
      year: year,
      price_per_kg: price
    };

    setSubmitting(true);

    try {
      if (editingPrice) {
        const editId = editingPrice.id || editingPrice.price_id;
        
        if (!editId) {
          toast.error("Cannot update: Invalid record ID");
          return;
        }
        
        await createAxiosRequest('put', `http://localhost:5000/api/barangay-crop-prices/${editId}`, payload);
        toast.success("Price updated successfully!");
      } else {
        const response = await createAxiosRequest('post', "http://localhost:5000/api/barangay-crop-prices", payload);
        if (response.data?.success) {
          toast.success("Price added successfully!");
        }
      }
      
      resetForm();
      
      setTimeout(() => {
        fetchAllData(false);
      }, 1000);
      
    } catch (err) {
      if (err.response?.status === 400) {
        toast.error(err.response?.data?.message || "Invalid input data");
      } else if (err.response?.status === 404) {
        toast.error("Record not found - it may have been deleted");
        fetchAllData(false);
      } else if (err.response?.status !== 401 && err.response?.status !== 403) {
        toast.error("Failed to save price. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      barangay: "",
      crop: "",
      season: "",
      year: new Date().getFullYear(),
      price_per_kg: "",
    });
    setSelectedBarangay(null);
    setSelectedCrop(null);
    setEditingPrice(null);
    setShowModal(false);
  };

  const handleEdit = (price) => {
    const barangay = data.barangays.find(b => b.id === price.barangay_id);
    const crop = data.crops.find(c => c.id === price.crop_id);
    
    if (!barangay || !crop) {
      toast.error("Cannot edit: Missing barangay or crop data");
      fetchAllData(false);
      return;
    }
    
    setFormData({
      barangay: barangay.name,
      crop: crop.name,
      season: price.season,
      year: price.year,
      price_per_kg: price.price_per_kg,
    });
    setSelectedBarangay(barangay);
    setSelectedCrop(crop);
    setEditingPrice({ 
      ...price, 
      id: price.id || price.price_id 
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this price record?")) {
      return;
    }

    if (!id) {
      toast.error("Cannot delete: Invalid record ID");
      return;
    }

    try {
      await axios({
        method: 'delete',
        url: `http://localhost:5000/api/barangay-crop-prices/${id}`,
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      toast.success("Price deleted successfully!");
      
      setTimeout(() => {
        fetchAllData(false);
      }, 500);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error("Record not found - it may have already been deleted");
        fetchAllData(false);
      } else if (err.response?.status === 400) {
        toast.error("Invalid request - please check the record ID");
      } else if (err.response?.status !== 401 && err.response?.status !== 403) {
        toast.error("Failed to delete price");
      }
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Market Prices
          </h1>
          <p className="text-gray-600 text-sm mt-1">Track and manage crop prices across barangays</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          Add Price
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
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
            />
          </div>
          <select
            className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
            value={filters.season}
            onChange={(e) => setFilters(prev => ({ ...prev, season: e.target.value }))}
          >
            <option value="All">All Seasons</option>
            <option value="dry">Dry Season</option>
            <option value="wet">Wet Season</option>
          </select>
          <select
            className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
            value={filters.year}
            onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
          >
            <option value="All">All Years</option>
            {getAvailableYears().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
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
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Price (₱/kg)</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPrices.length > 0 ? (
                filteredPrices.map((price) => (
                  <tr key={price.id} className="hover:bg-green-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{price.barangay?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{price.crop?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 capitalize">{price.season || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{price.year || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">₱{parseFloat(price.price_per_kg || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(price)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(price.price_id || price.id)}
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
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No price records found
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
                {editingPrice ? "Edit Price Record" : "Add Price Record"}
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
                      const barangay = data.barangays.find((b) => b.id.toString() === e.target.value);
                      setSelectedBarangay(barangay || null);
                      setFormData({ ...formData, barangay: barangay?.name || "" });
                    }}
                    required
                  >
                    <option value="">Select Barangay</option>
                    {data.barangays.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-control">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Crop</label>
                  <select
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    value={selectedCrop?.id?.toString() || ""}
                    onChange={(e) => {
                      const crop = data.crops.find((c) => c.id.toString() === e.target.value);
                      setSelectedCrop(crop || null);
                      setFormData({ ...formData, crop: crop?.name || "" });
                    }}
                    required
                  >
                    <option value="">Select Crop</option>
                    {data.crops.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
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
                    <option value="dry">Dry Season</option>
                    <option value="wet">Wet Season</option>
                  </select>
                </div>
                
                <div className="form-control">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                  <input
                    type="number"
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    required
                  />
                </div>
                
                <div className="form-control md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price per kg (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                    value={formData.price_per_kg}
                    onChange={(e) => setFormData({ ...formData, price_per_kg: e.target.value })}
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
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {submitting ? "Saving..." : (editingPrice ? "Update" : "Add") + " Price"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}