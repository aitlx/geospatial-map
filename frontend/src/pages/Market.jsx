import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Plus, Search, Edit2, Trash2, X } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslation } from "../hooks/useTranslation.js";

const STATUS_META = {
  pending: {
    labelKey: "status.pending",
    fallbackLabel: "Pending",
    badge: "border border-amber-200 bg-amber-50 text-amber-600",
  },
  verified: {
    labelKey: "status.verified",
    fallbackLabel: "Verified",
    badge: "border border-emerald-200 bg-emerald-50 text-emerald-600",
  },
  approved: {
    labelKey: "status.approved",
    fallbackLabel: "Approved",
    badge: "border border-emerald-200 bg-emerald-50 text-emerald-600",
  },
  rejected: {
    labelKey: "status.rejected",
    fallbackLabel: "Rejected",
    badge: "border border-rose-200 bg-rose-50 text-rose-600",
  },
};

const resolveStatusMeta = (value) => {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (key && STATUS_META[key]) {
    return { ...STATUS_META[key] };
  }

  if (key) {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return {
      labelKey: `status.${key}`,
      fallbackLabel: label,
      badge: "border border-slate-200 bg-slate-100 text-slate-600",
    };
  }

  return { ...STATUS_META.pending };
};

const formatMonthLabel = (value, locale = undefined) => {
  const monthNumber = Number(value);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return value ?? "—";
  }

  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    try {
      return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, monthNumber - 1, 1));
    } catch {
      // fall back to raw month number
    }
  }

  return monthNumber;
};

const createEmptyForm = () => ({
  season: "",
  year: String(new Date().getFullYear()),
  month: String(new Date().getMonth() + 1),
  price_per_kg: "",
});

axios.defaults.withCredentials = true;

const PAGE_SIZE = 15;

export default function Market() {
  const { t } = useTranslation();
  const [prices, setPrices] = useState([]);
  const [filters, setFilters] = useState({
    searchTerm: "",
    season: "All",
    year: "All",
  });
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [formData, setFormData] = useState(createEmptyForm);
  const [metadata, setMetadata] = useState({ barangays: [], crops: [] });
  const [currentUserId, setCurrentUserId] = useState(null);
  const [page, setPage] = useState(1);

  const userLocale = typeof window !== "undefined" && window.navigator ? window.navigator.language : undefined;

  const formatMonth = useCallback((value) => formatMonthLabel(value, userLocale), [userLocale]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const value = index + 1;
        return { value, label: formatMonth(value) };
      }),
    [formatMonth]
  );

  const yearOptions = useMemo(() => {
    if (!Array.isArray(prices) || prices.length === 0) return [];

    const years = new Set();
    prices.forEach((price) => {
      const yearValue = Number(price.year ?? price.year_recorded);
      if (!Number.isNaN(yearValue) && yearValue > 0) {
        years.add(String(yearValue));
      }
    });

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [prices]);

  useEffect(() => {
    if (filters.year !== "All" && !yearOptions.includes(filters.year)) {
      setFilters((prev) => ({ ...prev, year: "All" }));
    }
  }, [yearOptions, filters.year]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await axios.get("/api/user/me");
      const data = response.data?.data;
      const id = data?.userid ?? data?.userId ?? data?.id;
      if (id) {
        setCurrentUserId(Number(id));
      }
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  const fetchAllData = useCallback(
    async (withLoader = true) => {
      if (withLoader) {
        setLoading(true);
      }

      try {
        const [pricesRes, barangaysRes, cropsRes] = await Promise.all([
          axios.get("/api/barangay-crop-prices"),
          axios.get("/api/barangays/dropdown"),
          axios.get("/api/crops/dropdown"),
        ]);

        const barangays = Array.isArray(barangaysRes.data?.data)
          ? barangaysRes.data.data
          : [];
        const crops = Array.isArray(cropsRes.data?.data) ? cropsRes.data.data : [];
        setMetadata({ barangays, crops });

        const incoming = Array.isArray(pricesRes.data?.data) ? pricesRes.data.data : [];
        const normalized = incoming.map((item) => {
          const barangay = barangays.find((b) => b.id === item.barangay_id) || null;
          const crop = crops.find((c) => c.id === item.crop_id) || null;

          return {
            ...item,
            id: item.price_id ?? item.id,
            barangay,
            crop,
          };
        });

        setPrices(normalized);
      } catch {
        toast.error("Failed to load market prices.");
        setPrices([]);
      } finally {
        if (withLoader) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchCurrentUser();
    fetchAllData();
  }, [fetchCurrentUser, fetchAllData]);

  const filteredPrices = useMemo(() => {
    if (!Array.isArray(prices)) return [];

    const search = filters.searchTerm.trim().toLowerCase();
    const targetSeason = filters.season.toLowerCase();

    return prices.filter((price) => {
      const barangayName = price.barangay?.name?.toLowerCase() ?? "";
      const cropName = price.crop?.name?.toLowerCase() ?? "";
      const matchesSearch =
        !search || barangayName.includes(search) || cropName.includes(search);
      const matchesSeason =
        filters.season === "All" || (price.season ?? "").toLowerCase() === targetSeason;
      const matchesYear = filters.year === "All" || String(price.year) === filters.year;

      if (!showMineOnly) {
        return matchesSearch && matchesSeason && matchesYear;
      }

      if (currentUserId == null) {
        return matchesSearch && matchesSeason && matchesYear;
      }

      const ownerId =
        price.recorded_by_user_id ??
        price.recordedByUserId ??
        price.user_id ??
        price.created_by ??
        price.created_by_user_id;

      const matchesOwner = Number(ownerId) === Number(currentUserId);

      return matchesSearch && matchesSeason && matchesYear && matchesOwner;
    });
  }, [prices, filters, showMineOnly, currentUserId]);

  useEffect(() => {
    setPage(1);
  }, [filters, showMineOnly, prices]);

  const filteredCount = filteredPrices.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visiblePrices = useMemo(
    () => filteredPrices.slice(startIndex, endIndex),
    [filteredPrices, startIndex, endIndex]
  );
  const firstVisible = filteredCount === 0 ? 0 : startIndex + 1;
  const lastVisible = Math.min(endIndex, filteredCount);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreateModal = () => {
    setFormData(createEmptyForm());
    setSelectedBarangay(null);
    setSelectedCrop(null);
    setEditingPrice(null);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData(createEmptyForm());
    setSelectedBarangay(null);
    setSelectedCrop(null);
    setEditingPrice(null);
    setShowModal(false);
  };

  const handleEdit = (price) => {
    if (!price) return;

    const barangayOption =
      metadata.barangays.find((b) => b.id === price.barangay_id || b.id === price.barangay?.id) || null;
    const cropOption = metadata.crops.find((c) => c.id === price.crop_id || c.id === price.crop?.id) || null;

    setSelectedBarangay(barangayOption);
    setSelectedCrop(cropOption);
    setFormData({
      season: price.season ?? "",
      year: price.year ? String(price.year) : String(new Date().getFullYear()),
      month: price.month ? String(price.month) : String(new Date().getMonth() + 1),
      price_per_kg: price.price_per_kg != null ? String(price.price_per_kg) : "",
    });
    setEditingPrice({ ...price, id: price.id ?? price.price_id });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!id) {
      toast.error("Cannot delete: Invalid record ID");
      return;
    }

    const confirmed = window.confirm("Are you sure you want to delete this price record?");
    if (!confirmed) return;

    try {
      await axios.delete(`/api/barangay-crop-prices/${id}`);
      toast.success("Price deleted successfully!");

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("notifications:refresh", { detail: { source: "market-delete" } })
        );
      }

      setTimeout(() => {
        fetchAllData(false);
      }, 400);
    } catch (error) {
      const status = error.response?.status;
      if (status === 404) {
        toast.error("Record not found - it may have already been deleted");
        fetchAllData(false);
      } else if (status === 400) {
        toast.error("Invalid request - please check the record ID");
      } else if (![401, 403].includes(status)) {
        toast.error("Failed to delete price");
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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

    if (!formData.month) {
      toast.error("Please select a month");
      return;
    }

    if (!formData.price_per_kg) {
      toast.error("Please provide a price per kilogram");
      return;
    }

    const payload = {
      barangay_id: selectedBarangay.id,
      crop_id: selectedCrop.id,
      price_per_kg: Number(formData.price_per_kg),
      year: Number(formData.year),
      month: Number(formData.month),
      season: formData.season,
    };

    try {
      setSubmitting(true);

      if (editingPrice?.id) {
        await axios.put(`/api/barangay-crop-prices/${editingPrice.id}`, payload);
        toast.success("Price updated successfully!");
      } else {
        await axios.post("/api/barangay-crop-prices", payload);
        toast.success("Price added successfully!");
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("notifications:refresh", {
            detail: { source: editingPrice ? "market-update" : "market-create" },
          })
        );
      }

      resetForm();

      setTimeout(() => {
        fetchAllData(false);
      }, editingPrice ? 400 : 800);
    } catch (error) {
      const status = error.response?.status;
      if (status === 400) {
        toast.error(error.response?.data?.message || "Invalid input data");
      } else if (status === 404) {
        toast.error("Record not found - it may have been deleted");
        fetchAllData(false);
      } else if (![401, 403].includes(status)) {
        toast.error("Failed to save price. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white text-slate-900 transition-colors">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
              {t("market.pretitle", "Market Intelligence")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-700">{t("market.heading", "Market prices")}</h1>
            <p className="text-sm text-slate-500">
              {t("market.description", "Track and manage crop prices across barangays.")}
            </p>
          </div>
          <button
            onClick={openCreateModal}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-5 w-5" />
            {t("market.button.add", "Add price")}
          </button>
        </div>

  <div className="rounded-3xl border border-emerald-100/70 bg-white/90 p-5 shadow-md shadow-emerald-900/5 transition-colors">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500/70" />
              <input
                type="text"
                placeholder={t("market.filter.searchPlaceholder", "Search barangay or crop")}
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white pl-11 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={filters.searchTerm}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))
                }
              />
            </div>
            <select
              className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              value={filters.season}
              onChange={(e) => setFilters((prev) => ({ ...prev, season: e.target.value }))}
            >
              <option value="All">{t("market.filter.season.all", "All seasons")}</option>
              <option value="dry">{t("market.filter.season.dry", "Dry season")}</option>
              <option value="wet">{t("market.filter.season.wet", "Wet season")}</option>
            </select>
            <select
              className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              value={filters.year}
              onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
            >
              <option value="All">{t("market.filter.year.all", "All years")}</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowMineOnly((prev) => !prev)}
              className={`flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-all duration-200 ${
                showMineOnly
                  ? "border-emerald-300 bg-emerald-50 text-emerald-600 shadow-sm"
                  : "border-emerald-100 bg-white text-emerald-500 hover:border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              {showMineOnly
                ? t("market.filter.mineActive", "Showing my submissions")
                : t("market.filter.mine", "Show my submissions")}
            </button>
          </div>
        </div>
  <div className="hidden overflow-hidden rounded-3xl border border-emerald-100/70 bg-white/95 shadow-md shadow-emerald-900/5 transition-colors md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-emerald-100 text-sm">
              <thead className="bg-emerald-50/70 text-[0.6rem] uppercase tracking-[0.28em] text-emerald-600">
                <tr className="text-left text-emerald-500">
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("market.table.barangay", "Barangay")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("market.table.crop", "Crop")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("market.table.month", "Month")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("market.table.season", "Season")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("market.table.year", "Year")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("market.table.price", "Price per kg")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("market.table.status", "Status")}
                  </th>
                  <th scope="col" className="w-[110px] px-3 py-2.5 text-center font-semibold">
                    {t("market.table.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filteredCount > 0 ? (
                  visiblePrices.map((price) => {
                    const statusMeta = resolveStatusMeta(price.status ?? price.approval_status);
                    const monthLabel = formatMonth(price.month);
                    const barangayName = price.barangay?.name || "N/A";
                    const cropName = price.crop?.name || "N/A";
                    return (
                      <tr key={price.id} className="bg-white/60 align-middle transition hover:bg-emerald-50/60">
                        <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">
                          <span className="block max-w-[10rem] truncate" title={barangayName}>
                            {barangayName}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          <span className="block max-w-[10rem] truncate" title={cropName}>
                            {cropName}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                          {monthLabel}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 capitalize">
                          {price.season || "N/A"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{price.year || "N/A"}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-slate-800">
                          ₱{parseFloat(price.price_per_kg || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badge}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current/70"></span>
                            {t(statusMeta.labelKey, statusMeta.fallbackLabel)}
                          </span>
                        </td>
                        <td className="w-[110px] px-3 py-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(price)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-500 transition hover:border-emerald-300 hover:bg-emerald-50"
                              title={t("general.edit", "Edit")}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(price.price_id || price.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 transition hover:border-rose-300 hover:bg-rose-50"
                              title={t("general.delete", "Delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">
                      {t("market.empty", "No price records found.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 md:hidden">
          {filteredCount > 0 ? (
            visiblePrices.map((price) => {
              const statusMeta = resolveStatusMeta(price.status ?? price.approval_status);
              const barangayName = price.barangay?.name || "N/A";
              const cropName = price.crop?.name || "N/A";
              const monthLabel = formatMonth(price.month);

              return (
                <article
                  key={price.id}
                  className="rounded-3xl border border-emerald-100/70 bg-white/95 p-4 shadow-md shadow-emerald-900/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-500/80">
                        {barangayName}
                      </p>
                      <p className="text-base font-semibold text-slate-800">{cropName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(price)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-500 transition hover:border-emerald-300 hover:bg-emerald-50"
                        title={t("general.edit", "Edit")}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(price.price_id || price.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 transition hover:border-rose-300 hover:bg-rose-50"
                        title={t("general.delete", "Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("market.table.month", "Month")}
                      </dt>
                      <dd className="mt-1 text-slate-700">{monthLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("market.table.season", "Season")}
                      </dt>
                      <dd className="mt-1 capitalize text-slate-700">{price.season || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("market.table.year", "Year")}
                      </dt>
                      <dd className="mt-1 text-slate-700">{price.year || "N/A"}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("market.table.price", "Price per kg")}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-800">
                        ₱{parseFloat(price.price_per_kg || 0).toFixed(2)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("market.table.status", "Status")}
                      </dt>
                      <dd className="mt-1">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badge}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current/70"></span>
                          {t(statusMeta.labelKey, statusMeta.fallbackLabel)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl border border-emerald-100 bg-white/95 p-6 text-center text-sm text-slate-500 shadow-sm">
              {t("market.empty", "No price records found.")}
            </div>
          )}
        </div>

        {filteredCount > 0 ? (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-3xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-700 sm:flex-row">
            <span>
              {firstVisible === 0
                ? t("pagination.showingZero", "Showing 0 records")
                : t(
                    "pagination.showingRange",
                    `Showing ${firstVisible}-${lastVisible} of ${filteredCount} records`
                  )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => canGoPrevious && setPage((prev) => Math.max(1, prev - 1))}
                disabled={!canGoPrevious}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-1.5 font-semibold transition hover:bg-white hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("pagination.previous", "Previous")}
              </button>
              <span className="text-emerald-600/80">
                {t("pagination.pageOf", `Page ${currentPage} of ${totalPages}`)}
              </span>
              <button
                type="button"
                onClick={() => canGoNext && setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={!canGoNext}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-1.5 font-semibold transition hover:bg-white hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("pagination.next", "Next")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur">
          <div className="w-full max-w-full sm:max-w-lg max-h-[95vh] sm:max-h-[85vh] overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-900/10 transition-colors">
            <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/80 px-4 py-3 sm:px-6 sm:py-4">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingPrice
                  ? t("market.modal.editTitle", "Edit price record")
                  : t("market.modal.addTitle", "Add price record")}
              </h3>
              <button
                onClick={resetForm}
                className="rounded-full border border-transparent p-2 text-slate-500 transition hover:border-slate-200 hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6 overflow-y-auto max-h-[75vh] sm:max-h-[68vh]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                    {t("market.modal.barangay", "Barangay")}
                  </label>
                  <select
                    className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    value={selectedBarangay?.id?.toString() || ""}
                    onChange={(e) => {
                      const barangay = metadata.barangays.find((b) => b.id.toString() === e.target.value);
                      setSelectedBarangay(barangay || null);
                    }}
                    required
                  >
                    <option value="">{t("market.modal.selectBarangay", "Select barangay")}</option>
                    {metadata.barangays.map((barangay) => (
                      <option key={barangay.id} value={barangay.id}>
                        {barangay.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                    {t("market.modal.crop", "Crop")}
                  </label>
                  <select
                    className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    value={selectedCrop?.id?.toString() || ""}
                    onChange={(e) => {
                      const crop = metadata.crops.find((c) => c.id.toString() === e.target.value);
                      setSelectedCrop(crop || null);
                    }}
                    required
                  >
                    <option value="">{t("market.modal.selectCrop", "Select crop")}</option>
                    {metadata.crops.map((crop) => (
                      <option key={crop.id} value={crop.id}>
                        {crop.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                    {t("market.modal.season", "Season")}
                  </label>
                  <select
                    className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                    required
                  >
                    <option value="">{t("market.modal.selectSeason", "Select season")}</option>
                    <option value="dry">{t("market.filter.season.dry", "Dry season")}</option>
                    <option value="wet">{t("market.filter.season.wet", "Wet season")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                    {t("market.modal.month", "Month")}
                  </label>
                  <select
                    className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    value={formData.month ?? ""}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    required
                  >
                    <option value="">{t("market.modal.selectMonth", "Select month")}</option>
                    {monthOptions.map((option) => (
                      <option key={option.value} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                    {t("market.modal.year", "Year")}
                  </label>
                  <input
                    type="number"
                    className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                    {t("market.modal.price", "Price per kilogram")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    value={formData.price_per_kg}
                    onChange={(e) => setFormData({ ...formData, price_per_kg: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                >
                  {t("market.modal.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-full border border-transparent bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? t("market.modal.saving", "Saving...")
                    : editingPrice
                    ? t("market.modal.update", "Update price")
                    : t("market.modal.submit", "Add price")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}