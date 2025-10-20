import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { Plus, Search, Edit2, Trash2, X } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";

const createEmptyFormData = () => ({
  barangay: "",
  crop: "",
  season: "",
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  total_yield: "",
  area: "",
  yield_per_hectare: "",
});

const STATUS_META = {
  pending: {
    labelKey: "status.pending",
    defaultLabel: "Pending",
    badge: "border border-amber-200 bg-amber-50 text-amber-600",
  },
  verified: {
    labelKey: "status.verified",
    defaultLabel: "Verified",
    badge: "border border-emerald-200 bg-emerald-50 text-emerald-600",
  },
  rejected: {
    labelKey: "status.rejected",
    defaultLabel: "Rejected",
    badge: "border border-rose-200 bg-rose-50 text-rose-600",
  },
};

const resolveStatusMeta = (value, t) => {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (key && STATUS_META[key]) {
    const meta = STATUS_META[key];
    return {
      ...meta,
      label: t(meta.labelKey, meta.defaultLabel ?? meta.labelKey),
    };
  }

  if (key) {
    const normalized = key.charAt(0).toUpperCase() + key.slice(1);
    return {
      label: normalized,
      badge: "border border-slate-200 bg-slate-100 text-slate-600",
    };
  }

  const fallback = STATUS_META.pending;
  return {
    ...fallback,
    label: t(fallback.labelKey, fallback.defaultLabel ?? fallback.labelKey),
  };
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
      return monthNumber;
    }
  }

  return monthNumber;
};

axios.defaults.withCredentials = true;

const PAGE_SIZE = 15;

export default function YieldInput() {
  const { t } = useTranslation();
  const [yields, setYields] = useState([]);
  const [filteredYields, setFilteredYields] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [barangays, setBarangays] = useState([]);
  const [crops, setCrops] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingYield, setEditingYield] = useState(null);
  const [formData, setFormData] = useState(createEmptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);

  const yearOptions = useMemo(() => {
    if (!Array.isArray(yields) || yields.length === 0) return [];

    const uniqueYears = new Set();
    yields.forEach((item) => {
      const yearValue = Number(item.year);
      if (!Number.isNaN(yearValue) && yearValue > 0) {
        uniqueYears.add(yearValue);
      }
    });

    return Array.from(uniqueYears)
      .sort((a, b) => b - a)
      .map((year) => year.toString());
  }, [yields]);

  useEffect(() => {
    if (selectedYear !== "All" && !yearOptions.includes(selectedYear)) {
      setSelectedYear("All");
    }
  }, [yearOptions, selectedYear]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get("/api/user/me");
        const data = res.data?.data;
        const inferredId = data?.userid ?? data?.userId ?? data?.id ?? null;
        if (inferredId) {
          setCurrentUserId(Number(inferredId));
        }
      } catch {
        setCurrentUserId(null);
      }
    };

    fetchCurrentUser();
  }, []);

  const fetchYields = useCallback(async () => {
    try {
      const res = await axios.get("/api/barangay-yields");
      const incoming = Array.isArray(res.data?.data) ? res.data.data : [];
      const normalized = incoming.map((item) => ({
        ...item,
        id: item.yield_id ?? item.id,
      }));
      setYields(normalized);
    } catch {
      setYields([]);
    }
  }, []);

  const fetchBarangays = useCallback(async () => {
    try {
      const res = await axios.get("/api/barangays/dropdown");
      setBarangays(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setBarangays([]);
    }
  }, []);

  const fetchCrops = useCallback(async () => {
    try {
      const res = await axios.get("/api/crops/dropdown");
      setCrops(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setCrops([]);
    }
  }, []);

  useEffect(() => {
    fetchYields();
    fetchBarangays();
    fetchCrops();
  }, [fetchYields, fetchBarangays, fetchCrops]);

  useEffect(() => {
    if (!Array.isArray(yields)) return;

    const normalizedUserId = currentUserId != null ? Number(currentUserId) : null;

    const filtered = yields.filter((yieldItem) => {
      const barangayName = (yieldItem.barangay || "").toLowerCase();
      const cropName = (yieldItem.crop || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      const matchesSearch = barangayName.includes(search) || cropName.includes(search);
      const matchesSeason = selectedSeason === "All" || yieldItem.season === selectedSeason;
      const matchesYear = selectedYear === "All" || yieldItem.year?.toString() === selectedYear;
      const matchesOwner = !showMineOnly || normalizedUserId == null
        ? true
        : Number(yieldItem.recorded_by_user_id ?? yieldItem.recordedByUserId) === normalizedUserId;

      return matchesSearch && matchesSeason && matchesYear && matchesOwner;
    });

    setFilteredYields(filtered);
    setPage(1);
  }, [yields, searchTerm, selectedSeason, selectedYear, showMineOnly, currentUserId]);

  const userLocale = typeof window !== "undefined" && window.navigator ? window.navigator.language : undefined;

  const filteredCount = filteredYields.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleYields = useMemo(
    () => filteredYields.slice(startIndex, endIndex),
    [filteredYields, startIndex, endIndex]
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

  const formatMonth = useCallback(
    (value) => formatMonthLabel(value, userLocale),
    [userLocale]
  );

  const formatSeason = useCallback(
    (season) => {
      if (typeof season !== "string") return season ?? "—";
      const trimmed = season.trim();
      if (!trimmed) return "—";
      const normalized = trimmed.toLowerCase();
      if (normalized === "dry") return t("yield.filter.season.dry", trimmed);
      if (normalized === "wet") return t("yield.filter.season.wet", trimmed);
      return trimmed;
    },
    [t]
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const value = index + 1;
        return { value, label: formatMonth(value) };
      }),
    [formatMonth]
  );

  const openCreateModal = () => {
    setEditingYield(null);
    setSelectedBarangay(null);
    setSelectedCrop(null);
    setFormData(createEmptyFormData());
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData(createEmptyFormData());
    setSelectedBarangay(null);
    setSelectedCrop(null);
    setEditingYield(null);
    setIsSubmitting(false);
    setShowModal(false);
  };

  const handleEdit = (yieldItem) => {
    if (!yieldItem) return;

    const barangayOption = barangays.find((b) => b.id === yieldItem.barangay_id || b.id === yieldItem.barangayId);
    const cropOption = crops.find((c) => c.id === yieldItem.crop_id || c.id === yieldItem.cropId);

    setSelectedBarangay(barangayOption || null);
    setSelectedCrop(cropOption || null);
    setFormData({
      barangay: barangayOption?.name || yieldItem.barangay || "",
      crop: cropOption?.name || yieldItem.crop || "",
      season: yieldItem.season || "",
      year: yieldItem.year || new Date().getFullYear(),
      month: yieldItem.month || new Date().getMonth() + 1,
      total_yield: yieldItem.total_yield ?? "",
      area: yieldItem.total_area_planted_ha ?? yieldItem.area ?? "",
      yield_per_hectare: yieldItem.yield_per_hectare ?? "",
    });
    setEditingYield(yieldItem);
    setShowModal(true);
  };

  const handleDelete = async (yieldId) => {
    if (!yieldId) return;
    if (!window.confirm(t("yield.confirm.delete", "Are you sure you want to delete this yield record?"))) return;

    try {
      await axios.delete(`/api/barangay-yields/${yieldId}`);
      await fetchYields();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notifications:refresh", { detail: { source: "yield-delete" } }));
      }
    } catch {
      alert(t("yield.alert.deleteError", "Failed to delete yield record. Please try again."));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedBarangay?.id || !selectedCrop?.id) {
      alert(t("yield.alert.selectionRequired", "Please select both a barangay and a crop before saving."));
      return;
    }

    setIsSubmitting(true);
    const payload = {
      barangay_id: Number(selectedBarangay.id),
      crop_id: Number(selectedCrop.id),
      year: Number(formData.year),
      month: Number(formData.month),
      season: formData.season,
      total_yield: Number(formData.total_yield),
      total_area_planted_ha: Number(formData.area),
      yield_per_hectare: Number(formData.yield_per_hectare),
    };

    try {
      if (editingYield) {
        const targetId = editingYield.id ?? editingYield.yield_id;
        await axios.put(`/api/barangay-yields/${targetId}`, payload);
      } else {
        await axios.post("/api/barangay-yields", payload);
      }

      await fetchYields();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notifications:refresh", { detail: { source: editingYield ? "yield-update" : "yield-create" } }));
      }
      resetForm();
    } catch {
      alert(t("yield.alert.saveError", "Failed to save yield. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">{t("yield.pretitle", "Yield Management")}</p>
            <h1 className="mt-2 text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-700">{t("yield.heading", "Yield records")}</h1>
            <p className="text-sm text-slate-500">{t("yield.description", "Log harvest performance across barangays and keep data in sync.")}</p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <Plus className="h-5 w-5" />
            {t("yield.addRecord", "Add record")}
          </button>
        </div>

        <div className="rounded-3xl border border-emerald-100/70 bg-white/90 p-5 shadow-md shadow-emerald-900/5 transition-colors">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500/70" />
              <input
                type="text"
                placeholder={t("yield.filter.search", "Search barangay or crop")}
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white pl-11 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
            >
              <option value="All">{t("yield.filter.season.all", "All seasons")}</option>
              <option value="Dry">{t("yield.filter.season.dry", "Dry season")}</option>
              <option value="Wet">{t("yield.filter.season.wet", "Wet season")}</option>
            </select>
            <select
              className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="All">{t("yield.filter.year.all", "All years")}</option>
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
                ? t("yield.filter.showMineActive", "Showing my submissions")
                : t("yield.filter.showMine", "Show my submissions")}
            </button>
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-3xl border border-emerald-100/70 bg-white/95 shadow-md shadow-emerald-900/5 transition-colors md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-emerald-100 text-sm">
              <thead className="bg-emerald-50/70 text-[0.6rem] uppercase tracking-[0.28em] text-emerald-600">
                <tr className="text-left text-emerald-500">
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("yield.table.barangay", "Barangay")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("yield.table.crop", "Crop")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("yield.table.month", "Month")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("yield.table.season", "Season")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("yield.table.year", "Year")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("yield.table.totalYield", "Total yield")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("yield.table.area", "Area (ha)")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("yield.table.yieldPerHa", "Yield/ha")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("yield.table.status", "Status")}</th>
                  <th scope="col" className="w-[110px] px-3 py-2.5 text-center font-semibold">{t("yield.table.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filteredCount > 0 ? (
                  visibleYields.map((yieldItem) => {
                    const statusMeta = resolveStatusMeta(yieldItem.status, t);
                    const monthLabel = formatMonth(yieldItem.month);
                    const totalYield = Number(yieldItem.total_yield);
                    const area = Number(yieldItem.total_area_planted_ha ?? yieldItem.area);
                    const yieldPerHectare = Number(yieldItem.yield_per_hectare);
                    const barangayName = yieldItem.barangay || "N/A";
                    const cropName = yieldItem.crop || "N/A";
                    const seasonLabel = formatSeason(yieldItem.season);

                    return (
                      <tr
                        key={yieldItem.id || yieldItem.yield_id || `${yieldItem.barangay}-${yieldItem.year}`}
                        className="bg-white/60 align-middle transition hover:bg-emerald-50/60"
                      >
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
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{monthLabel}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{seasonLabel}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{yieldItem.year}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-slate-800">
                          {Number.isFinite(totalYield) ? `${totalYield.toLocaleString()} kg` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                          {Number.isFinite(area) ? area : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                          {Number.isFinite(yieldPerHectare) ? `${yieldPerHectare} kg/ha` : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badge}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current/70"></span>
                            {statusMeta.label ?? t(statusMeta.labelKey ?? "", statusMeta.defaultLabel ?? statusMeta.labelKey ?? "")}
                          </span>
                        </td>
                        <td className="w-[110px] px-3 py-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(yieldItem)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-500 transition hover:border-emerald-300 hover:bg-emerald-50"
                              title={t("general.edit", "Edit")}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(yieldItem.id ?? yieldItem.yield_id)}
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
                    <td colSpan="10" className="px-4 py-10 text-center text-sm text-slate-500">
                      {t("yield.empty", "No yield records found.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 md:hidden">
          {filteredCount > 0 ? (
            visibleYields.map((yieldItem) => {
              const statusMeta = resolveStatusMeta(yieldItem.status, t);
              const totalYield = Number(yieldItem.total_yield);
              const area = Number(yieldItem.total_area_planted_ha ?? yieldItem.area);
              const yieldPerHectare = Number(yieldItem.yield_per_hectare);
              const barangayName = yieldItem.barangay || "N/A";
              const cropName = yieldItem.crop || "N/A";
              const monthLabel = formatMonth(yieldItem.month);
              const seasonLabel = formatSeason(yieldItem.season);

              return (
                <article
                  key={yieldItem.id || yieldItem.yield_id || `${yieldItem.barangay}-${yieldItem.year}`}
                  className="rounded-3xl border border-emerald-100/70 bg-white/95 p-4 shadow-md shadow-emerald-900/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
            <div className="w-full max-w-full sm:max-w-lg max-h-[95vh] sm:max-h-[85vh] overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-900/10 transition-colors">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-500/80">
                        {barangayName}
                      </p>
                      <p className="text-base font-semibold text-slate-800">{cropName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(yieldItem)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-500 transition hover:border-emerald-300 hover:bg-emerald-50"
                        title={t("general.edit", "Edit")}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(yieldItem.id ?? yieldItem.yield_id)}
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
                        {t("yield.table.month", "Month")}
                      </dt>
                      <dd className="mt-1 text-slate-700">{monthLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("yield.table.season", "Season")}
                      </dt>
                      <dd className="mt-1 text-slate-700">{seasonLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("yield.table.year", "Year")}
                      </dt>
                      <dd className="mt-1 text-slate-700">{yieldItem.year || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("yield.table.totalYield", "Total yield")}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-800">
                        {Number.isFinite(totalYield) ? `${totalYield.toLocaleString()} kg` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("yield.table.area", "Area (ha)")}
                      </dt>
                      <dd className="mt-1 text-slate-700">{Number.isFinite(area) ? area : "—"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("yield.table.yieldPerHa", "Yield/ha")}
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700">
                        {Number.isFinite(yieldPerHectare) ? `${yieldPerHectare} kg/ha` : "—"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-500/70">
                        {t("yield.table.status", "Status")}
                      </dt>
                      <dd className="mt-1">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.badge}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current/70"></span>
                          {statusMeta.label ?? t(statusMeta.labelKey ?? "", statusMeta.defaultLabel ?? statusMeta.labelKey ?? "")}
                        </span>
                      </dd>
</div>
</dl>
</article>
);
})
) : (
<div className="rounded-3xl border border-emerald-100 bg-white/95 p-6 text-center text-sm text-slate-500 shadow-sm">
{t("yield.empty", "No yield records found.")}
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
  <div className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-900/10 transition-colors">
        <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/80 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-800">
            {editingYield
              ? t("yield.modal.editTitle", "Edit yield record")
              : t("yield.modal.addTitle", "Add yield record")}
          </h3>
          <button
            onClick={resetForm}
            className="rounded-full border border-transparent p-2 text-slate-500 transition hover:border-slate-200 hover:bg-white"
            title={t("general.close", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6 overflow-y-auto max-h-[68vh]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                {t("yield.modal.barangay", "Barangay")}
              </label>
              <select
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={selectedBarangay?.id?.toString() || ""}
                onChange={(e) => {
                  const barangay = barangays.find((b) => b.id?.toString() === e.target.value);
                  setSelectedBarangay(barangay || null);
                  setFormData((prev) => ({ ...prev, barangay: barangay?.name || "" }));
                }}
                required
              >
                <option value="">{t("yield.modal.selectBarangay", "Select barangay")}</option>
                {barangays.map((b) => (
                  <option key={b.id} value={b.id?.toString()}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                {t("yield.modal.crop", "Crop")}
              </label>
              <select
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={selectedCrop?.id?.toString() || ""}
                onChange={(e) => {
                  const crop = crops.find((c) => c.id?.toString() === e.target.value);
                  setSelectedCrop(crop || null);
                  setFormData((prev) => ({ ...prev, crop: crop?.name || "" }));
                }}
                required
              >
                <option value="">{t("yield.modal.selectCrop", "Select crop")}</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id?.toString()}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                {t("yield.modal.season", "Season")}
              </label>
              <select
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={formData.season}
                onChange={(e) => setFormData((prev) => ({ ...prev, season: e.target.value }))}
                required
              >
                <option value="">{t("yield.modal.selectSeason", "Select season")}</option>
                <option value="Dry">{t("yield.filter.season.dry", "Dry season")}</option>
                <option value="Wet">{t("yield.filter.season.wet", "Wet season")}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                {t("yield.modal.month", "Month")}
              </label>
              <select
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={formData.month?.toString() || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, month: Number(e.target.value) }))}
                required
              >
                <option value="">{t("yield.modal.selectMonth", "Select month")}</option>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value.toString()}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                {t("yield.modal.year", "Year")}
              </label>
              <input
                type="number"
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={formData.year}
                onChange={(e) => setFormData((prev) => ({ ...prev, year: Number(e.target.value) }))}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                {t("yield.modal.totalYield", "Total yield (kg)")}
              </label>
              <input
                type="number"
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={formData.total_yield}
                onChange={(e) => setFormData((prev) => ({ ...prev, total_yield: Number(e.target.value) }))}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                {t("yield.modal.area", "Area (hectares)")}
              </label>
              <input
                type="number"
                step="0.01"
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={formData.area}
                onChange={(e) => setFormData((prev) => ({ ...prev, area: Number(e.target.value) }))}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                {t("yield.modal.yieldPerHa", "Yield per hectare (kg/ha)")}
              </label>
              <input
                type="number"
                step="0.01"
                className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                value={formData.yield_per_hectare}
                onChange={(e) => setFormData((prev) => ({ ...prev, yield_per_hectare: Number(e.target.value) }))}
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
              {t("general.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full border border-transparent bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? t("general.saving", "Saving...")
                : editingYield
                  ? t("yield.modal.save", "Save changes")
                  : t("yield.modal.submit", "Submit record")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</>
);
}