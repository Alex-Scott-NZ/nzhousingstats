// src\app\components\PropertyDashboard.tsx
"use client";

import { useState, useMemo, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { createSlug } from "../../lib/slugs";
import styles from "./PropertyDashboard.module.scss";

const LISTING_TYPE = "HOUSES_TO_BUY";

// Add isomorphic layout effect hook
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface TotalsData {
  total: number;
  regions: number;
  districts: number;
  suburbs: number;
  lastUpdated: string;
}

interface DatabaseLocationSnapshot {
  id: number;
  snapshotDate: string;
  listingType: string;
  regionId: number;
  regionName: string;
  districtId: number | null;
  districtName: string | null;
  suburbId: number | null;
  suburbName: string | null;
  locationType: string;
  listingCount: number | null;
  collectedAt: string;
}

interface DatabaseWeeklySnapshot {
  id: number;
  snapshotDate: string;
  listingType: string;
  totalNzListings: number;
  collectedAt: string;
  rawData: string;
}

interface HistoricalSnapshot {
  id: number;
  snapshot_date: string;
  collected_at: string;
  listing_type: string;
  total_listings: number;
  region_id?: number;
  district_id?: number;
  suburb_id?: number;
}

interface ListingTypeData {
  totals: TotalsData | null;
  regions: DatabaseLocationSnapshot[];
  districts: DatabaseLocationSnapshot[];
  suburbs: DatabaseLocationSnapshot[];
}

interface AllData {
  HOUSES_TO_BUY: ListingTypeData;
  HOUSES_TO_RENT: ListingTypeData;
}

interface DropdownOption {
  id: number;
  name: string;
  regionName?: string;
}

interface PropertyDashboardProps {
  allData: AllData;
  snapshots: DatabaseWeeklySnapshot[];
  historicalData: HistoricalSnapshot[];
  initialRegionId?: number;
  initialDistrictId?: number;
  initialSuburbId?: number;
}

interface ChartDataPoint {
  date: string;
  listings: number;
}

type SortColumn = "name" | "listingCount" | "weekChange" | "monthChange";
type SortOrder = "asc" | "desc";
type LocationLevel = "region" | "district" | "suburb";

// Simple Sparkline component
const SimpleSparkline = ({
  data,
  width = 60,
  height = 20,
}: {
  data: number[];
  width?: number;
  height?: number;
}) => {
  if (!data || data.length < 2) {
    return <div className="w-16 h-5 bg-gray-100 border border-gray-300"></div>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const trend = data[data.length - 1] > data[0] ? "up" : "down";
  const color = trend === "up" ? "#10B981" : "#EF4444";

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
};

const NoTrendDataMessage = ({
  level,
  name,
  currentListings,
}: {
  level: string;
  name: string;
  currentListings?: number;
}) => (
  <div className="h-48 flex items-center justify-center">
    <div className="text-center">
      <div className="text-2xl mb-2">📊</div>
      <p className="text-sm font-bold mb-2 text-gray-600">
        No trend data available for {name}
      </p>
      <p className="text-xs text-gray-500">
        Historical data collection may not include {level}-level tracking yet.
      </p>
      <p className="text-xs mt-2 text-gray-500">
        Current listing count: {currentListings?.toLocaleString() || "N/A"}
      </p>
    </div>
  </div>
);

export default function PropertyDashboard({
  allData,
  snapshots,
  historicalData,
  initialRegionId,
  initialDistrictId,
  initialSuburbId,
}: PropertyDashboardProps) {
  const router = useRouter();

  // Add hydration protection
  const [mounted, setMounted] = useState(false);

  // Use isomorphic effect for hydration
  useIsomorphicLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Use initial props for display, but don't allow state changes (navigation handles that)
  const [selectedRegionId] = useState<number | null>(initialRegionId || null);
  const [selectedDistrictId] = useState<number | null>(
    initialDistrictId || null
  );
  const [selectedSuburbId] = useState<number | null>(initialSuburbId || null);
  const [sortBy, setSortBy] = useState<SortColumn>("listingCount");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchTerm, setSearchTerm] = useState("");

  const currentListingData: ListingTypeData = allData[LISTING_TYPE];
  const totals: TotalsData | null = currentListingData?.totals;

  // Date formatting function with hydration protection
  const formatDate = (dateString: string) => {
    if (!mounted) {
      // Return a static fallback during SSR
      return new Date(dateString).toISOString().split("T")[0]; // Simple YYYY-MM-DD format
    }

    // Client-side formatting
    return new Date(dateString).toLocaleString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTrendData = (
    selectedRegionId: number | null,
    selectedDistrictId: number | null,
    selectedSuburbId: number | null
  ): HistoricalSnapshot[] => {
    console.log("🎯 Getting trend data for:", {
      selectedRegionId,
      selectedDistrictId,
      selectedSuburbId,
    });

    let filteredData: HistoricalSnapshot[];

    if (selectedSuburbId) {
      console.log("🔍 Filtering for suburb:", selectedSuburbId);
      console.log(
        "📊 Available historical data sample:",
        historicalData.slice(0, 5)
      );
      console.log(
        "📊 Historical data fields:",
        historicalData[0] ? Object.keys(historicalData[0]) : []
      );

      filteredData = historicalData.filter((record) => {
        const matches =
          record.listing_type === LISTING_TYPE &&
          record.suburb_id === selectedSuburbId;
        if (matches) {
          console.log("✅ Found matching suburb record:", record);
        }
        return matches;
      });

      console.log("📊 Suburb filter results:", {
        selectedSuburbId,
        totalHistoricalRecords: historicalData.length,
        matchingRecords: filteredData.length,
        filteredData: filteredData,
        hasSuburbIdField: historicalData.some((h) => h.suburb_id !== undefined),
        suburbIdsInData: [
          ...new Set(
            historicalData
              .map((h) => h.suburb_id)
              .filter((id) => id !== null && id !== undefined)
          ),
        ].slice(0, 10),
      });
    } else if (selectedDistrictId) {
      filteredData = historicalData.filter(
        (record) =>
          record.listing_type === LISTING_TYPE &&
          record.district_id === selectedDistrictId &&
          record.suburb_id === null
      );
      console.log("📊 District filter applied:", {
        selectedDistrictId,
        results: filteredData.length,
      });
    } else if (selectedRegionId) {
      filteredData = historicalData.filter(
        (record) =>
          record.listing_type === LISTING_TYPE &&
          record.region_id === selectedRegionId &&
          record.district_id === null
      );
      console.log("📊 Region filter applied:", {
        selectedRegionId,
        results: filteredData.length,
      });
    } else {
      filteredData = historicalData.filter(
        (record) =>
          record.listing_type === LISTING_TYPE &&
          record.region_id === null &&
          record.district_id === null
      );
      console.log("📊 National filter applied:", {
        results: filteredData.length,
      });
    }

    const sortedData = filteredData.sort(
      (a, b) =>
        new Date(a.snapshot_date).getTime() -
        new Date(b.snapshot_date).getTime()
    );

    console.log("📈 Final trend data:", {
      totalRecords: sortedData.length,
      dateRange:
        sortedData.length > 0
          ? {
              from: sortedData[0].snapshot_date,
              to: sortedData[sortedData.length - 1].snapshot_date,
            }
          : null,
      values: sortedData.map((d) => d.total_listings),
      sampleRecords: sortedData.slice(0, 3),
    });

    return sortedData;
  };

  const transformForChart = (
    trendData: HistoricalSnapshot[]
  ): ChartDataPoint[] => {
    const chartData = trendData.map((record) => ({
      date: new Date(record.snapshot_date).toLocaleDateString("en-NZ", {
        month: "short",
        day: "numeric",
      }),
      listings: record.total_listings,
    }));

    console.log("📊 Chart data transformed:", {
      originalLength: trendData.length,
      chartLength: chartData.length,
      chartData: chartData,
    });

    return chartData;
  };

  const rawTrendData = useMemo(() => {
    return getTrendData(selectedRegionId, selectedDistrictId, selectedSuburbId);
  }, [historicalData, selectedRegionId, selectedDistrictId, selectedSuburbId]);

  const trendData = useMemo(() => {
    return transformForChart(rawTrendData);
  }, [rawTrendData]);

  const chartYAxisDomain = useMemo(() => {
    if (trendData.length === 0) return [0, 100];

    const values = trendData.map((d) => d.listings);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    const padding = Math.max(range * 0.1, 5);

    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
  }, [trendData]);

  useEffect(() => {
    if (selectedRegionId && !selectedDistrictId) {
      const regionalData = historicalData.filter(
        (h) =>
          h.region_id === selectedRegionId &&
          h.district_id === null &&
          h.listing_type === LISTING_TYPE
      );

      const districtData = historicalData.filter(
        (h) =>
          h.region_id === selectedRegionId &&
          h.district_id !== null &&
          h.listing_type === LISTING_TYPE
      );

      console.log("🔍 Data validation for selected region:", {
        selectedRegionId,
        regionalRecords: regionalData.length,
        districtRecords: districtData.length,
        regionalData: regionalData,
        districtData: districtData.slice(0, 3),
        mixedDataProblem:
          districtData.length > 0
            ? "YES - Districts found when expecting regional totals"
            : "NO",
      });
    }
  }, [selectedRegionId, selectedDistrictId, historicalData]);

  const changeMetrics = useMemo(() => {
    if (trendData.length < 2) {
      console.log("⚠️ Not enough trend data for metrics:", trendData.length);
      return null;
    }

    const oldest = trendData[0].listings;
    const newest = trendData[trendData.length - 1].listings;
    const change = newest - oldest;
    const changePercent = (change / oldest) * 100;

    console.log("📊 Change metrics:", {
      oldest,
      newest,
      change,
      changePercent,
      trendDataLength: trendData.length,
      allListings: trendData.map((t) => t.listings),
    });

    return {
      change,
      changePercent,
      deltaType: change > 0 ? "increase" : "decrease",
    };
  }, [trendData]);

  const availableRegions = useMemo((): DropdownOption[] => {
    if (!currentListingData?.regions) {
      return [];
    }

    const regions = currentListingData.regions
      .map((region: DatabaseLocationSnapshot) => ({
        id: region.regionId,
        name: region.regionName,
      }))
      .sort((a: DropdownOption, b: DropdownOption) =>
        a.name.localeCompare(b.name)
      );

    return regions;
  }, [currentListingData]);

  const availableDistricts = useMemo((): DropdownOption[] => {
    if (!selectedRegionId || !currentListingData?.districts) return [];

    const districts = currentListingData.districts
      .filter(
        (district: DatabaseLocationSnapshot) =>
          district.regionId === selectedRegionId
      )
      .map((district: DatabaseLocationSnapshot) => ({
        id: district.districtId!,
        name: district.districtName!,
        regionName: district.regionName,
      }))
      .sort((a: DropdownOption, b: DropdownOption) =>
        a.name.localeCompare(b.name)
      );

    return districts;
  }, [selectedRegionId, currentListingData]);

  const availableSuburbs = useMemo((): DropdownOption[] => {
    if (!selectedDistrictId || !currentListingData?.suburbs) return [];

    const suburbs = currentListingData.suburbs
      .filter(
        (suburb: DatabaseLocationSnapshot) =>
          suburb.districtId === selectedDistrictId
      )
      .map((suburb: DatabaseLocationSnapshot) => ({
        id: suburb.suburbId!,
        name: suburb.suburbName!,
        regionName: suburb.regionName,
      }))
      .sort((a: DropdownOption, b: DropdownOption) =>
        a.name.localeCompare(b.name)
      );

    return suburbs;
  }, [selectedDistrictId, currentListingData]);

  const currentDisplayData = useMemo((): DatabaseLocationSnapshot[] => {
    if (!currentListingData) {
      return [];
    }

    let data: DatabaseLocationSnapshot[] = [];

    if (selectedSuburbId) {
      return [];
    } else if (selectedDistrictId) {
      data =
        currentListingData.suburbs?.filter(
          (suburb: DatabaseLocationSnapshot) =>
            suburb.districtId === selectedDistrictId
        ) || [];
    } else if (selectedRegionId) {
      data =
        currentListingData.districts?.filter(
          (district: DatabaseLocationSnapshot) =>
            district.regionId === selectedRegionId
        ) || [];
    } else {
      data = currentListingData.regions || [];
    }

    return data;
  }, [
    currentListingData,
    selectedRegionId,
    selectedDistrictId,
    selectedSuburbId,
  ]);

  const selectedRegionName: string | undefined = selectedRegionId
    ? availableRegions.find((r: DropdownOption) => r.id === selectedRegionId)
        ?.name
    : undefined;
  const selectedDistrictName: string | undefined = selectedDistrictId
    ? availableDistricts.find(
        (d: DropdownOption) => d.id === selectedDistrictId
      )?.name
    : undefined;

  const selectedSuburbName: string | undefined = selectedSuburbId
    ? availableSuburbs.find((s: DropdownOption) => s.id === selectedSuburbId)
        ?.name
    : undefined;

  const selectedSuburbData = useMemo(() => {
    if (!selectedSuburbId || !currentListingData?.suburbs) return null;

    return currentListingData.suburbs.find(
      (suburb: DatabaseLocationSnapshot) => suburb.suburbId === selectedSuburbId
    );
  }, [selectedSuburbId, currentListingData]);

  useEffect(() => {
    if (selectedSuburbId) {
      console.log("🏘️ Suburb selected - debugging:", {
        selectedSuburbId,
        selectedSuburbName,
        selectedSuburbData,
        suburbHistoricalRecords: historicalData.filter(
          (h) => h.suburb_id === selectedSuburbId
        ),
        historicalDataSample: historicalData.slice(0, 3),
        hasSuburbData: historicalData.some((h) => h.suburb_id !== null),
        allSuburbIds: [
          ...new Set(
            historicalData.map((h) => h.suburb_id).filter((id) => id !== null)
          ),
        ].slice(0, 10),
        currentSuburbInList: currentListingData?.suburbs?.find(
          (s) => s.suburbId === selectedSuburbId
        ),
      });
    }
  }, [
    selectedSuburbId,
    selectedSuburbName,
    selectedSuburbData,
    historicalData,
    currentListingData,
  ]);

  const filteredTotals = useMemo(() => {
    if (!currentListingData) return null;

    let relevantData: DatabaseLocationSnapshot[] = [];
    let locationName = "New Zealand";
    let totalListings = 0;
    let itemCount = 0;

    if (selectedSuburbId && selectedSuburbData) {
      totalListings = selectedSuburbData.listingCount || 0;
      itemCount = 1;
      locationName = selectedSuburbName || "Selected Suburb";
    } else if (selectedDistrictId) {
      relevantData =
        currentListingData.suburbs?.filter(
          (suburb: DatabaseLocationSnapshot) =>
            suburb.districtId === selectedDistrictId
        ) || [];
      locationName = selectedDistrictName || "Selected District";
      totalListings = relevantData.reduce(
        (sum, item) => sum + (item.listingCount || 0),
        0
      );
      itemCount = relevantData.length;
    } else if (selectedRegionId) {
      relevantData =
        currentListingData.districts?.filter(
          (district: DatabaseLocationSnapshot) =>
            district.regionId === selectedRegionId
        ) || [];
      locationName = selectedRegionName || "Selected Region";
      totalListings = relevantData.reduce(
        (sum, item) => sum + (item.listingCount || 0),
        0
      );
      itemCount = relevantData.length;
    } else {
      relevantData = currentListingData.regions || [];
      locationName = "New Zealand";
      totalListings = relevantData.reduce(
        (sum, item) => sum + (item.listingCount || 0),
        0
      );
      itemCount = relevantData.length;
    }

    return {
      total: totalListings,
      count: itemCount,
      locationName: locationName,
      level: selectedSuburbId
        ? "suburb"
        : selectedDistrictId
        ? "suburbs"
        : selectedRegionId
        ? "districts"
        : "regions",
    };
  }, [
    currentListingData,
    selectedRegionId,
    selectedDistrictId,
    selectedSuburbId,
    selectedSuburbData,
    selectedRegionName,
    selectedDistrictName,
    selectedSuburbName,
  ]);

  const locationTrends = useMemo(() => {
    const trends: Record<
      string,
      {
        weekChange: number;
        monthChange: number | null;
        weekPercent: number;
        monthPercent: number | null;
        sparklineData: number[];
        hasMonthlyData: boolean;
      }
    > = {};

    currentDisplayData.forEach((item) => {
      const locationId = selectedDistrictId
        ? item.suburbId
        : selectedRegionId
        ? item.districtId
        : item.regionId;

      let locationHistory = historicalData.filter((h) => {
        if (h.listing_type !== LISTING_TYPE) return false;

        if (selectedDistrictId) return h.suburb_id === locationId;
        if (selectedRegionId)
          return h.district_id === locationId && h.suburb_id === null;
        return h.region_id === locationId && h.district_id === null;
      });

      locationHistory = locationHistory.sort(
        (a, b) =>
          new Date(a.snapshot_date).getTime() -
          new Date(b.snapshot_date).getTime()
      );

      if (locationHistory.length >= 2) {
        const current =
          locationHistory[locationHistory.length - 1]?.total_listings || 0;
        const weekAgo =
          locationHistory[locationHistory.length - 2]?.total_listings || 0;

        const hasMonthlyData = locationHistory.length >= 5;
        const monthAgo = hasMonthlyData
          ? locationHistory[locationHistory.length - 5]?.total_listings || 0
          : null;

        const weekChange = current - weekAgo;
        const monthChange =
          hasMonthlyData && monthAgo !== null ? current - monthAgo : null;
        const weekPercent = weekAgo ? (weekChange / weekAgo) * 100 : 0;
        const monthPercent =
          hasMonthlyData && monthAgo ? (monthChange! / monthAgo) * 100 : null;

        const sparklineData = locationHistory
          .slice(-8)
          .map((h) => h.total_listings);

        trends[String(locationId)] = {
          weekChange,
          monthChange,
          weekPercent,
          monthPercent,
          sparklineData,
          hasMonthlyData,
        };
      }
    });

    return trends;
  }, [
    currentDisplayData,
    historicalData,
    selectedRegionId,
    selectedDistrictId,
  ]);

  const handleSort = (column: SortColumn): void => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder(
        column === "listingCount" ||
          column === "weekChange" ||
          column === "monthChange"
          ? "desc"
          : "asc"
      );
    }
  };

  const getCurrentLevel = (): LocationLevel => {
    if (selectedSuburbId) return "suburb";
    if (selectedDistrictId) return "suburb";
    if (selectedRegionId) return "district";
    return "region";
  };

  const currentLevel: LocationLevel = getCurrentLevel();
  const levelName: string =
    currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);

  const getCurrentLocationName = (item: DatabaseLocationSnapshot): string => {
    if (currentLevel === "region") {
      return item.regionName || "Unknown Region";
    } else if (currentLevel === "district") {
      return item.districtName || "Unknown District";
    } else if (currentLevel === "suburb") {
      return item.suburbName || "Unknown Suburb";
    }
    return "Unknown";
  };

  const displayData = useMemo((): DatabaseLocationSnapshot[] => {
    const sorted = [...currentDisplayData].sort(
      (a: DatabaseLocationSnapshot, b: DatabaseLocationSnapshot) => {
        let aValue: string | number, bValue: string | number;

        if (sortBy === "listingCount") {
          aValue = a.listingCount || 0;
          bValue = b.listingCount || 0;
        } else if (sortBy === "weekChange" || sortBy === "monthChange") {
          // Get trend data for sorting
          const aLocationId = selectedDistrictId
            ? a.suburbId
            : selectedRegionId
            ? a.districtId
            : a.regionId;
          const bLocationId = selectedDistrictId
            ? b.suburbId
            : selectedRegionId
            ? b.districtId
            : b.regionId;

          const aTrends = locationTrends[String(aLocationId)];
          const bTrends = locationTrends[String(bLocationId)];

          if (sortBy === "weekChange") {
            aValue = aTrends?.weekChange || 0;
            bValue = bTrends?.weekChange || 0;
          } else {
            // monthChange
            aValue = aTrends?.monthChange || 0;
            bValue = bTrends?.monthChange || 0;
          }
        } else {
          // Name sorting
          if (currentLevel === "region") {
            aValue = a.regionName || "";
            bValue = b.regionName || "";
          } else if (currentLevel === "district") {
            aValue = a.districtName || "";
            bValue = b.districtName || "";
          } else if (currentLevel === "suburb") {
            aValue = a.suburbName || "";
            bValue = b.suburbName || "";
          } else {
            aValue = "";
            bValue = "";
          }
        }

        if (
          sortBy === "listingCount" ||
          sortBy === "weekChange" ||
          sortBy === "monthChange"
        ) {
          return sortOrder === "desc"
            ? (bValue as number) - (aValue as number)
            : (aValue as number) - (bValue as number);
        } else {
          return sortOrder === "asc"
            ? (aValue as string).localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue as string);
        }
      }
    );

    return sorted;
  }, [currentDisplayData, sortBy, sortOrder, currentLevel, locationTrends]);

  const filteredDisplayData = useMemo(() => {
    if (!searchTerm.trim() || currentLevel !== "suburb") {
      return displayData;
    }

    return displayData.filter((item) => {
      const name = getCurrentLocationName(item).toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    });
  }, [displayData, searchTerm, currentLevel]);

  const getItemUrl = (item: DatabaseLocationSnapshot): string => {
    if (currentLevel === "region") {
      return `/${createSlug(item.regionName)}`;
    }
    if (currentLevel === "district") {
      const region = availableRegions.find((r) => r.id === item.regionId);
      if (region) {
        return `/${createSlug(region.name)}/${createSlug(item.districtName!)}`;
      }
    }
    if (currentLevel === "suburb") {
      const district = availableDistricts.find((d) => d.id === item.districtId);
      const region = availableRegions.find((r) => r.id === item.regionId);
      if (district && region) {
        return `/${createSlug(region.name)}/${createSlug(
          district.name
        )}/${createSlug(item.suburbName!)}`;
      }
    }
    return "#";
  };

  const getRegionUrl = (): string => {
    if (selectedRegionName) {
      return `/${createSlug(selectedRegionName)}`;
    }
    return "/";
  };

  const getDistrictUrl = (): string => {
    if (selectedRegionName && selectedDistrictName) {
      return `/${createSlug(selectedRegionName)}/${createSlug(
        selectedDistrictName
      )}`;
    }
    return "/";
  };

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return <span className="text-gray-400">↕️</span>;
    return (
      <span className="text-blue-600">{sortOrder === "asc" ? "↑" : "↓"}</span>
    );
  };

  if (!totals) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          No data available for property listings. Make sure data collection is
          running.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className={styles["sketch-box"]}>
        <div className="p-4 sm:p-5 pb-3 sm:pb-4 text-sm sm:text-base bg-[#fe90e8]">
          <Link
            href="/"
            className="font-bold px-2 py-1 border-2 border-[#fe90e8] hover:border-black hover:bg-black hover:text-[#fe90e8] text-black uppercase transition-all duration-200"
          >
            New Zealand
          </Link>
          {selectedRegionName && (
            <>
              <span className="mx-2 sm:mx-3 text-black font-bold">›</span>
              <Link
                href={getRegionUrl()}
                className="font-bold px-2 py-1 border-2 border-[#fe90e8] hover:border-black hover:bg-black hover:text-[#fe90e8] text-black uppercase transition-all duration-200"
              >
                {selectedRegionName}
              </Link>
            </>
          )}
          {selectedDistrictName && (
            <>
              <span className="mx-2 sm:mx-3 text-black font-bold">›</span>
              {selectedSuburbId ? (
                <Link
                  href={getDistrictUrl()}
                  className="font-bold px-2 py-1 border-2 border-[#fe90e8] hover:border-black hover:bg-black hover:text-[#fe90e8] text-black uppercase transition-all duration-200"
                >
                  {selectedDistrictName}
                </Link>
              ) : (
                <span className="font-bold text-black uppercase px-2 py-1 border-2 border-[#fe90e8]">
                  {selectedDistrictName}
                </span>
              )}
            </>
          )}
          {selectedSuburbName && (
            <>
              <span className="mx-2 sm:mx-3 text-black font-bold">›</span>
              <span className="font-bold text-black uppercase px-2 py-1 border-2 border-[#fe90e8]">
                {selectedSuburbName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <div className={styles["sketch-box"]}>
        <div className="p-4 sm:p-6 lg:p-10">
          <div className="mb-3 sm:mb-4 pb-2">
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 text-gray-800 relative uppercase">
                📊{" "}
                <span className="underline decoration-double">
                  {selectedSuburbName
                    ? `${selectedSuburbName} Suburb Details`
                    : selectedDistrictName
                    ? `${selectedDistrictName} District`
                    : selectedRegionName
                    ? `${selectedRegionName} Region`
                    : "New Zealand Overview"}
                </span>
              </h2>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-10">
            <div className="bg-white p-4 sm:p-6 border-4 border-black text-center transition-all hover:transform hover:-translate-y-2 hover:shadow-[8px_8px_0px_#000] relative shadow-[4px_4px_0px_#000]">
              <div className="text-3xl sm:text-4xl font-bold mb-2 underline decoration-double text-gray-800">
                {filteredTotals?.total.toLocaleString() ||
                  totals.total.toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm mb-3 font-semibold uppercase tracking-wide text-gray-500">
                {filteredTotals
                  ? `${filteredTotals.locationName} Listings`
                  : "Total Listings"}
              </div>
              <div className="text-sm sm:text-base font-bold flex items-center justify-center gap-2 px-3 py-2 border-2 border-black text-black bg-[#13b99d] uppercase">
                <span>↗</span>
                <span>Houses for Sale</span>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-6 border-4 border-black text-center transition-all hover:transform hover:-translate-y-2 hover:shadow-[8px_8px_0px_#000] relative shadow-[4px_4px_0px_#000]">
              <div className="text-3xl sm:text-4xl font-bold mb-2 underline decoration-double text-gray-800">
                {changeMetrics
                  ? (changeMetrics.change > 0 ? "+" : "") +
                    changeMetrics.change.toLocaleString()
                  : "N/A"}
              </div>
              <div className="text-xs sm:text-sm mb-3 font-semibold uppercase tracking-wide text-gray-500">
                Trend Change
              </div>
              <div
                className={`text-sm sm:text-base font-bold flex items-center justify-center gap-2 px-3 py-2 border-2 border-black text-black uppercase ${
                  changeMetrics?.deltaType === "increase"
                    ? "bg-[#13b99d]"
                    : "bg-[#ff4910]"
                }`}
              >
                <span>
                  {changeMetrics?.deltaType === "increase" ? "↗" : "↘"}
                </span>
                <span>
                  {changeMetrics
                    ? `${changeMetrics.changePercent.toFixed(1)}%`
                    : "No data"}
                </span>
              </div>
            </div>
          </div>

          {/* Chart Container */}
          <div className="bg-white border-2 border-gray-800 p-3 sm:p-5 relative shadow-[inset_2px_2px_0px_#f0f0f0]">
            <div className="absolute -top-4 left-3 sm:left-5 bg-[#7dfaff] px-2 font-bold border-2 border-gray-800 text-black uppercase text-sm sm:text-base">
              {selectedSuburbName ||
                selectedDistrictName ||
                selectedRegionName ||
                "New Zealand"}{" "}
              CHART 📈
            </div>

            {trendData.length > 1 && (
              <div className="mb-4 text-center">
                <div className="text-xs text-gray-600 font-semibold uppercase">
                  RANGE:{" "}
                  {Math.min(
                    ...trendData.map((d) => d.listings)
                  ).toLocaleString()}{" "}
                  -{" "}
                  {Math.max(
                    ...trendData.map((d) => d.listings)
                  ).toLocaleString()}{" "}
                  LISTINGS
                </div>
              </div>
            )}

            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={trendData}
                  margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#666" }}
                    tickFormatter={(value) => value.toUpperCase()}
                  />
                  <YAxis
                    domain={chartYAxisDomain}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#666" }}
                    width={35}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      "LISTINGS",
                    ]}
                    labelStyle={{ color: "#333" }}
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "2px solid #333",
                      borderRadius: "0px",
                      fontSize: "14px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="listings"
                    stroke="#333"
                    strokeWidth={3}
                    dot={{ fill: "#333", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "#333", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : selectedSuburbId ? (
              <NoTrendDataMessage
                level="suburb"
                name={selectedSuburbName || "this suburb"}
                currentListings={selectedSuburbData?.listingCount || 0}
              />
            ) : (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl mb-2">📊</div>
                  <p className="text-sm text-gray-600">
                    Collecting trend data...
                  </p>
                  <p className="text-xs text-gray-500">
                    More data points needed for chart ({trendData.length}{" "}
                    available)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Table */}
      {!selectedSuburbId && (
        <div className={styles["sketch-box"]}>
          <div className="p-6 border-b-2 border-gray-800">
            {/* Header with conditional search */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <h3 className="text-2xl font-bold text-gray-800 relative">
                📋 {levelName}s by Listings
                {selectedRegionName && ` in ${selectedRegionName}`}
                {selectedDistrictName && ` in ${selectedDistrictName}`}
              </h3>

              {/* Search Box - Only for suburbs */}
              {currentLevel === "suburb" && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search suburbs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border-2 border-black font-bold uppercase text-sm focus:outline-none focus:shadow-[4px_4px_0px_#000] transition-all duration-200 bg-white w-full lg:w-64"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-black font-bold text-lg leading-none"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Results count - Only show when searching suburbs */}
            {currentLevel === "suburb" && searchTerm && (
              <div className="text-sm text-gray-600 font-semibold mt-3 pt-3 border-t border-dashed border-gray-300">
                Showing {filteredDisplayData.length} of {displayData.length}{" "}
                suburbs
                {searchTerm && ` matching "${searchTerm}"`}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th
                    className="p-5 text-left bg-gray-50 font-bold text-lg cursor-pointer select-none transition-all hover:bg-gray-100 uppercase tracking-wide border-r border-dashed border-gray-300 text-gray-800"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{levelName}</span>
                      <SortIndicator column="name" />
                    </div>
                  </th>
                  <th
                    className="p-5 text-left bg-gray-50 font-bold text-lg cursor-pointer select-none transition-all hover:bg-gray-100 uppercase tracking-wide border-r border-dashed border-gray-300 text-gray-800"
                    onClick={() => handleSort("listingCount")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Listings</span>
                      <SortIndicator column="listingCount" />
                    </div>
                  </th>
                  <th className="p-5 text-left bg-gray-50 font-bold text-lg cursor-pointer select-none transition-all hover:bg-gray-100 uppercase tracking-wide border-r border-dashed border-gray-300 text-gray-800">
                    % of Total
                  </th>
                  <th
                    className="p-5 text-left bg-gray-50 font-bold text-lg cursor-pointer select-none transition-all hover:bg-gray-100 uppercase tracking-wide border-r border-dashed border-gray-300 text-gray-800"
                    onClick={() => handleSort("weekChange")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>1 Week</span>
                      <SortIndicator column="weekChange" />
                    </div>
                  </th>
                  <th
                    className="p-5 text-left bg-gray-50 font-bold text-lg cursor-pointer select-none transition-all hover:bg-gray-100 uppercase tracking-wide border-r border-dashed border-gray-300 text-gray-800"
                    onClick={() => handleSort("monthChange")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>1 Month</span>
                      <SortIndicator column="monthChange" />
                    </div>
                  </th>
                  <th className="p-5 text-left bg-gray-50 font-bold text-lg cursor-pointer select-none transition-all hover:bg-gray-100 uppercase tracking-wide text-gray-800">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDisplayData.map(
                  (item: DatabaseLocationSnapshot, index: number) => {
                    const name: string = getCurrentLocationName(item);
                    const isClickable =
                      currentLevel === "region" ||
                      currentLevel === "district" ||
                      currentLevel === "suburb";

                    const locationId = selectedDistrictId
                      ? item.suburbId
                      : selectedRegionId
                      ? item.districtId
                      : item.regionId;
                    const trends = locationTrends[String(locationId)];

                    return (
                      <tr
                        key={`${item.id}-${index}`}
                        className={`${styles["table-row"]} transition-all border-b border-dashed border-gray-300`}
                      >
                        <td className="p-5 whitespace-nowrap">
                          {isClickable ? (
                            <Link
                              href={getItemUrl(item)}
                              className={`text-lg font-semibold uppercase tracking-wide ${styles["clickable-location"]} block`}
                            >
                              {name}
                            </Link>
                          ) : (
                            <div className="text-lg font-semibold uppercase tracking-wide text-gray-800">
                              {name}
                            </div>
                          )}
                          {currentLevel === "suburb" && (
                            <div className="text-xs text-gray-500">
                              {item.districtName}
                            </div>
                          )}
                        </td>
                        <td className="p-5 whitespace-nowrap text-lg font-semibold uppercase tracking-wide text-gray-800">
                          {item.listingCount?.toLocaleString()}
                        </td>
                        <td className="p-5 whitespace-nowrap text-lg text-gray-500">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-lg">
                              {(
                                ((item.listingCount || 0) /
                                  (filteredTotals?.total || totals.total)) *
                                100
                              ).toFixed(1)}
                              %
                            </span>
                            <div className="ml-3 flex-1 max-w-[100px] bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    ((item.listingCount || 0) /
                                      (filteredTotals?.total || totals.total)) *
                                      100
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="p-5 whitespace-nowrap text-lg">
                          {trends ? (
                            <div
                              className="flex items-center gap-1"
                              style={{
                                color:
                                  trends.weekChange >= 0
                                    ? "#04865D"
                                    : "#dc2626",
                              }}
                            >
                              <span className="font-bold">
                                {trends.weekChange >= 0 ? "+" : ""}
                                {trends.weekChange}
                              </span>
                              <span className="text-sm">
                                ({trends.weekPercent >= 0 ? "+" : ""}
                                {trends.weekPercent.toFixed(1)}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="p-5 whitespace-nowrap text-lg ">
                          {trends &&
                          trends.hasMonthlyData &&
                          trends.monthChange !== null ? (
                            <div
                              className="flex items-center gap-1"
                              style={{
                                color:
                                  trends.monthChange >= 0
                                    ? "#04865D"
                                    : "#dc2626",
                              }}
                            >
                              <span className="font-bold">
                                {trends.monthChange >= 0 ? "+" : ""}
                                {trends.monthChange}
                              </span>
                              <span className="text-xs">
                                ({trends.monthPercent! >= 0 ? "+" : ""}
                                {trends.monthPercent!.toFixed(1)}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="p-5">
                          {trends?.sparklineData ? (
                            <SimpleSparkline data={trends.sparklineData} />
                          ) : (
                            <div className="w-16 h-5 bg-gray-100 border border-gray-300"></div>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suburb details */}
      {selectedSuburbId && (
        <div className={styles["sketch-box"]}>
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">🏘️</div>
            <h3 className="text-2xl font-bold mb-4 text-gray-800 relative">
              Suburb Level Detail
            </h3>
            <p className="text-lg mb-2 text-gray-500">
              You've reached the most detailed level available.
            </p>
            <p className="text-sm text-gray-400">
              {selectedSuburbName} has{" "}
              <span className="font-bold text-gray-800">
                {selectedSuburbData?.listingCount?.toLocaleString() || 0}
              </span>{" "}
              property listings.
            </p>
            <div className="mt-6">
              <Link
                href={getDistrictUrl()}
                className="px-4 py-2 border-2 border-gray-800 bg-white font-semibold transition-all hover:bg-gray-50 hover:transform hover:-translate-y-1 hover:shadow-[2px_2px_0px_#333] text-gray-800 inline-block"
              >
                ← Back to {selectedDistrictName} Suburbs
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
