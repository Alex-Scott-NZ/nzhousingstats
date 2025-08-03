// src/app/components/PropertyDashboard.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Use more flexible types that match what the database returns
type HouseListingType = "HOUSES_TO_BUY" | "HOUSES_TO_RENT";

interface TotalsData {
  total: number;
  regions: number;
  districts: number;
  suburbs: number;
  lastUpdated: string;
}

// Use flexible types that match database returns
interface DatabaseLocationSnapshot {
  id: number;
  snapshotDate: string;
  listingType: string; // Database returns string, not strict union
  regionId: number;
  regionName: string;
  districtId: number | null;
  districtName: string | null;
  suburbId: number | null;
  suburbName: string | null;
  locationType: string; // Database returns string, not strict union
  listingCount: number | null;
  collectedAt: string;
}

interface DatabaseWeeklySnapshot {
  id: number;
  snapshotDate: string;
  listingType: string; // Database returns string
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
}

type SortColumn = "name" | "listingCount";
type SortOrder = "asc" | "desc";
type LocationLevel = "region" | "district" | "suburb";

export default function PropertyDashboard({
  allData,
  snapshots,
  historicalData,
}: PropertyDashboardProps) {
  const [selectedListingType, setSelectedListingType] =
    useState<HouseListingType>("HOUSES_TO_BUY");
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(
    null
  );
  const [sortBy, setSortBy] = useState<SortColumn>("listingCount");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [animationKey, setAnimationKey] = useState(0);

  // Get current listing data
  const currentListingData: ListingTypeData = allData[selectedListingType];
  const totals: TotalsData | null = currentListingData?.totals;

  console.log("🔍 Filter State:", {
    selectedListingType,
    selectedRegionId,
    selectedDistrictId,
    sortBy,
    sortOrder,
    hasData: !!currentListingData,
    totalRegions: currentListingData?.regions?.length || 0,
    totalDistricts: currentListingData?.districts?.length || 0,
    totalSuburbs: currentListingData?.suburbs?.length || 0,
    historicalDataPoints: historicalData.length,
  });

  // Trigger animation restart when data changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [selectedListingType, selectedRegionId, selectedDistrictId, sortBy, sortOrder]);

  // Prepare trend data
  const trendData = useMemo(() => {
    return historicalData
      .filter((h) => h.listing_type === selectedListingType)
      .map((h) => ({
        date: new Date(h.snapshot_date).toLocaleDateString("en-NZ", {
          month: "short",
          day: "numeric",
        }),
        listings: h.total_listings,
        fullDate: h.snapshot_date,
      }));
  }, [historicalData, selectedListingType]);

  // Calculate change metrics
  const changeMetrics = useMemo(() => {
    if (trendData.length < 2) return null;

    const oldest = trendData[0].listings;
    const newest = trendData[trendData.length - 1].listings;
    const change = newest - oldest;
    const changePercent = (change / oldest) * 100;

    return {
      change,
      changePercent,
      deltaType: change > 0 ? "increase" : "decrease",
    };
  }, [trendData]);

  // Get available regions for dropdown
  const availableRegions = useMemo((): DropdownOption[] => {
    if (!currentListingData?.regions) return [];

    return currentListingData.regions
      .map((region: DatabaseLocationSnapshot) => ({
        id: region.regionId,
        name: region.regionName,
      }))
      .sort((a: DropdownOption, b: DropdownOption) =>
        a.name.localeCompare(b.name)
      );
  }, [currentListingData]);

  // Get available districts for selected region
  const availableDistricts = useMemo((): DropdownOption[] => {
    if (!selectedRegionId || !currentListingData?.districts) return [];

    return currentListingData.districts
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
  }, [selectedRegionId, currentListingData]);

  // Get current data to display based on filter selections
  const currentDisplayData = useMemo((): DatabaseLocationSnapshot[] => {
    if (!currentListingData) return [];

    if (selectedDistrictId) {
      // Show suburbs in selected district
      return (
        currentListingData.suburbs?.filter(
          (suburb: DatabaseLocationSnapshot) =>
            suburb.districtId === selectedDistrictId
        ) || []
      );
    } else if (selectedRegionId) {
      // Show districts in selected region
      return (
        currentListingData.districts?.filter(
          (district: DatabaseLocationSnapshot) =>
            district.regionId === selectedRegionId
        ) || []
      );
    } else {
      // Show all regions
      return currentListingData.regions || [];
    }
  }, [currentListingData, selectedRegionId, selectedDistrictId]);

  // Get selected region/district names for breadcrumb display
  const selectedRegionName: string | undefined = selectedRegionId
    ? availableRegions.find((r: DropdownOption) => r.id === selectedRegionId)
        ?.name
    : undefined;
  const selectedDistrictName: string | undefined = selectedDistrictId
    ? availableDistricts.find(
        (d: DropdownOption) => d.id === selectedDistrictId
      )?.name
    : undefined;

  // Calculate filtered totals based on current selection
  const filteredTotals = useMemo(() => {
    if (!currentListingData) return null;

    let relevantData: DatabaseLocationSnapshot[] = [];
    let locationName = "New Zealand";

    if (selectedDistrictId) {
      // Show totals for selected district (sum of all suburbs in that district)
      relevantData = currentListingData.suburbs?.filter(
        (suburb: DatabaseLocationSnapshot) => suburb.districtId === selectedDistrictId
      ) || [];
      locationName = selectedDistrictName || "Selected District";
    } else if (selectedRegionId) {
      // Show totals for selected region (sum of all districts in that region)
      relevantData = currentListingData.districts?.filter(
        (district: DatabaseLocationSnapshot) => district.regionId === selectedRegionId
      ) || [];
      locationName = selectedRegionName || "Selected Region";
    } else {
      // Show country totals
      relevantData = currentListingData.regions || [];
      locationName = "New Zealand";
    }

    const totalListings = relevantData.reduce((sum, item) => sum + (item.listingCount || 0), 0);
    const itemCount = relevantData.length;

    return {
      total: totalListings,
      count: itemCount,
      locationName: locationName,
      level: selectedDistrictId ? "suburbs" : selectedRegionId ? "districts" : "regions"
    };
  }, [currentListingData, selectedRegionId, selectedDistrictId, selectedRegionName, selectedDistrictName]);

  // Handle region selection
  const handleRegionChange = (regionId: string): void => {
    const id = regionId ? Number(regionId) : null;
    setSelectedRegionId(id);
    setSelectedDistrictId(null); // Reset district when region changes

    console.log(
      "🗺️ Region changed to:",
      id,
      availableDistricts.length > 0
        ? `(${availableDistricts.length} districts available)`
        : "(no districts found)"
    );
  };

  // Handle district selection
  const handleDistrictChange = (districtId: string): void => {
    const id = districtId ? Number(districtId) : null;
    setSelectedDistrictId(id);

    const suburbsInDistrict =
      currentListingData?.suburbs?.filter(
        (s: DatabaseLocationSnapshot) => s.districtId === id
      ) || [];
    console.log(
      "🏘️ District changed to:",
      id,
      `(${suburbsInDistrict.length} suburbs available)`
    );
  };

  // Handle clicking on region/district names in the table
  const handleLocationClick = (item: DatabaseLocationSnapshot): void => {
    if (currentLevel === "region") {
      // Clicking on a region - drill down to show districts
      setSelectedRegionId(item.regionId);
      setSelectedDistrictId(null);
      console.log("🔽 Drilling down to region:", item.regionName, "ID:", item.regionId);
    } else if (currentLevel === "district") {
      // Clicking on a district - drill down to show suburbs
      setSelectedDistrictId(item.districtId);
      console.log("🔽 Drilling down to district:", item.districtName, "ID:", item.districtId);
    }
    // For suburbs, we don't drill down further
  };

  // Handle column header clicks for sorting
  const handleSort = (column: SortColumn): void => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder(column === "listingCount" ? "desc" : "asc");
    }
    console.log("🔄 Sort changed:", {
      column,
      order: sortOrder === "asc" ? "desc" : "asc",
    });
  };

  // Sort data - REMOVED LIMIT, NOW SHOWS ALL DATA
  const displayData = useMemo((): DatabaseLocationSnapshot[] => {
    const sorted = [...currentDisplayData].sort(
      (a: DatabaseLocationSnapshot, b: DatabaseLocationSnapshot) => {
        let aValue: string | number, bValue: string | number;

        if (sortBy === "listingCount") {
          aValue = a.listingCount || 0;
          bValue = b.listingCount || 0;
        } else {
          aValue = a.regionName || a.districtName || a.suburbName || "";
          bValue = b.regionName || b.districtName || b.suburbName || "";
        }

        if (sortBy === "listingCount") {
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

    // Return all sorted data - no more limiting to 10
    return sorted;
  }, [currentDisplayData, sortBy, sortOrder]);

  // Determine what we're showing
  const getCurrentLevel = (): LocationLevel => {
    if (selectedDistrictId) return "suburb";
    if (selectedRegionId) return "district";
    return "region";
  };

  const currentLevel: LocationLevel = getCurrentLevel();
  const levelName: string =
    currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);

  // Get current location name for display
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

  // Sort indicator component
  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return <span className="text-gray-300">↕️</span>;
    return (
      <span className="text-blue-600">{sortOrder === "asc" ? "↑" : "↓"}</span>
    );
  };

  if (!totals) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          No data available for {selectedListingType}. Make sure data collection
          is running.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-5 space-y-5 font-['Kalam',cursive] bg-[#fafafa] min-h-screen bg-[linear-gradient(#e8e8e8_1px,transparent_1px),linear-gradient(90deg,#e8e8e8_1px,transparent_1px)] bg-[20px_20px]">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&display=swap');
        
        .sketch-box {
          background: white;
          border: 3px solid #333;
          border-radius: 0;
          box-shadow: 3px 3px 0px #333;
          position: relative;
          margin-bottom: 20px;
        }

        .sketch-box:before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          border: 2px dashed #666;
          pointer-events: none;
          opacity: 0.3;
        }

        .yellow-highlight {
          position: relative;
          display: inline-block;
        }

        .yellow-highlight:before {
          content: '';
          position: absolute;
          top: 50%;
          left: -8px;
          right: -12px;
          height: 20px;
          background: linear-gradient(45deg, #FFD700 0%, #FFED4A 25%, #FFD700 50%, #FFED4A 75%, #FFD700 100%);
          transform: translateY(-50%) rotate(-1deg);
          z-index: -1;
          opacity: 0.7;
          border-radius: 3px;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          background: #10B981;
          border: 2px solid #333;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.7;
            transform: scale(1.1);
          }
        }

        .time-btn {
          padding: 8px 16px;
          border: 1px solid #333;
          background: white;
          cursor: pointer;
          font-family: 'Kalam', cursive;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s ease;
          color: #333;
          position: relative;
        }

        .time-btn.active {
          background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
          color: white;
          transform: translateY(-2px);
          box-shadow: 2px 2px 0px #1E40AF;
        }

        .time-btn:hover:not(.active) {
          background: #DBEAFE;
          transform: translateY(-1px);
        }

        .stat-change {
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid #333;
          transition: all 0.3s ease;
        }

        .stat-change.positive {
          color: white;
          background: linear-gradient(45deg, #10B981 0%, #059669 50%, #10B981 100%);
        }

        .stat-change.negative {
          color: white;
          background: linear-gradient(45deg, #EF4444 0%, #DC2626 50%, #EF4444 100%);
        }

        .cascading-row-${animationKey} {
          opacity: 0;
          transform: translateX(-30px) translateY(20px) scale(0.95);
          animation: cascadeIn-${animationKey} 0.8s ease-out forwards;
        }

        @keyframes cascadeIn-${animationKey} {
          0% {
            opacity: 0;
            transform: translateX(-30px) translateY(20px) scale(0.95);
          }
          60% {
            opacity: 0.8;
            transform: translateX(5px) translateY(-2px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
        }

        .table-row:hover {
          background: #f9f9f9;
          transform: translateX(8px) scale(1.02);
          box-shadow: -4px 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10;
        }

        .clickable-location {
          color: #333;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: underline;
          text-decoration-style: dotted;
        }

        .clickable-location:hover {
          color: #000;
          text-decoration-style: solid;
          transform: translateX(3px);
        }
      `}</style>

      {/* Header */}
      <div className="sketch-box">
        <div className="p-8 text-center border-b-2 border-dashed border-gray-800">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 yellow-highlight relative">
            Property Listings Tracker ✏️
          </h1>
          <p className="text-gray-600 text-lg font-normal mt-2">
            Real-time insights into New Zealand's property market trends
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="sketch-box">
        <div className="p-4 text-base bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.05)_2px,rgba(0,0,0,0.05)_4px)]">
          <span
            className="text-gray-800 underline decoration-wavy cursor-pointer font-semibold hover:text-black hover:shadow-[1px_1px_0px_#ddd] transition-all"
            onClick={() => {
              setSelectedRegionId(null);
              setSelectedDistrictId(null);
            }}
          >
            🇳🇿 New Zealand
          </span>
          {selectedRegionName && (
            <>
              <span className="text-gray-600 mx-3">›</span>
              <span
                className="text-gray-800 underline decoration-wavy cursor-pointer font-semibold hover:text-black"
                onClick={() => setSelectedDistrictId(null)}
              >
                {selectedRegionName}
              </span>
            </>
          )}
          {selectedDistrictName && (
            <>
              <span className="text-gray-600 mx-3">›</span>
              <span className="text-gray-800 font-semibold">{selectedDistrictName}</span>
            </>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <div className="sketch-box">
        <div className="p-10">
          <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-5">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2 yellow-highlight relative">
                📊 {selectedDistrictName ? `${selectedDistrictName} Suburbs` : selectedRegionName ? `${selectedRegionName} Districts` : 'New Zealand Overview'}
              </h2>
              <div className="text-gray-600 text-sm flex items-center gap-2 border border-dashed border-gray-400 p-2 bg-gray-50">
                <div className="status-dot"></div>
                <span>Last updated: <span>{new Date(totals.lastUpdated).toLocaleString('en-NZ', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</span></span>
              </div>
            </div>
            <div className="flex gap-1 border-2 border-gray-800 p-1">
              <button
                className={`time-btn ${selectedListingType === 'HOUSES_TO_BUY' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedListingType('HOUSES_TO_BUY');
                  setSelectedRegionId(null);
                  setSelectedDistrictId(null);
                }}
              >
                🏠 Buy
              </button>
              <button
                className={`time-btn ${selectedListingType === 'HOUSES_TO_RENT' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedListingType('HOUSES_TO_RENT');
                  setSelectedRegionId(null);
                  setSelectedDistrictId(null);
                }}
              >
                🏡 Rent
              </button>
            </div>
          </div>

          {/* Summary Stats - NOW DYNAMIC BASED ON SELECTION */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white p-6 border-2 border-gray-800 text-center transition-all hover:transform hover:-translate-y-1 hover:rotate-[-1deg] hover:shadow-[4px_4px_0px_#333] relative shadow-[2px_2px_0px_#333]">
              <div className="absolute top-1 left-1 right-1 bottom-1 border border-dashed border-gray-300 pointer-events-none"></div>
              <div className="text-4xl font-bold text-gray-800 mb-2 underline decoration-double">
                {filteredTotals?.total.toLocaleString() || totals.total.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mb-3 font-semibold uppercase tracking-wide">
                {filteredTotals ? `${filteredTotals.locationName} Listings` : 'Total Listings'}
              </div>
              <div className="stat-change positive">
                <span>↗</span>
                <span>
                  {filteredTotals ? `Active in ${filteredTotals.locationName}` : 'Current active listings'}
                </span>
              </div>
            </div>

            <div className="bg-white p-6 border-2 border-gray-800 text-center transition-all hover:transform hover:-translate-y-1 hover:rotate-[-1deg] hover:shadow-[4px_4px_0px_#333] relative shadow-[2px_2px_0px_#333]">
              <div className="absolute top-1 left-1 right-1 bottom-1 border border-dashed border-gray-300 pointer-events-none"></div>
              <div className="text-4xl font-bold text-gray-800 mb-2 underline decoration-double">
                {displayData.length}
              </div>
              <div className="text-sm text-gray-600 mb-3 font-semibold uppercase tracking-wide">Showing</div>
              <div className="stat-change positive">
                <span>↗</span>
                <span>{levelName}s visible</span>
              </div>
            </div>

            <div className="bg-white p-6 border-2 border-gray-800 text-center transition-all hover:transform hover:-translate-y-1 hover:rotate-[-1deg] hover:shadow-[4px_4px_0px_#333] relative shadow-[2px_2px_0px_#333]">
              <div className="absolute top-1 left-1 right-1 bottom-1 border border-dashed border-gray-300 pointer-events-none"></div>
              <div className="text-4xl font-bold text-gray-800 mb-2 underline decoration-double">
                {changeMetrics ? (changeMetrics.change > 0 ? '+' : '') + changeMetrics.change.toLocaleString() : 'N/A'}
              </div>
              <div className="text-sm text-gray-600 mb-3 font-semibold uppercase tracking-wide">Trend Change</div>
              <div className={`stat-change ${changeMetrics?.deltaType === 'increase' ? 'positive' : 'negative'}`}>
                <span>{changeMetrics?.deltaType === 'increase' ? '↗' : '↘'}</span>
                <span>{changeMetrics ? `${changeMetrics.changePercent.toFixed(1)}%` : 'No data'}</span>
              </div>
            </div>
          </div>

          {/* Chart Container - LINE CHART */}
          <div className="bg-white border-2 border-gray-800 p-5 relative shadow-[inset_2px_2px_0px_#f0f0f0]">
            <div className="absolute -top-4 left-5 bg-white px-2 font-bold text-gray-800 border-2 border-gray-800">
              CHART 📈
            </div>
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={trendData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#666", fontFamily: 'Kalam' }}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      "Listings",
                    ]}
                    labelStyle={{ color: "#333", fontFamily: 'Kalam' }}
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "2px solid #333",
                      borderRadius: "0px",
                      fontSize: "14px",
                      fontFamily: 'Kalam',
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
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-2xl mb-2">📊</div>
                  <p className="text-sm">Collecting trend data...</p>
                  <p className="text-xs text-gray-400">
                    More data points needed for chart
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sketch-box">
        <div className="p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-4 yellow-highlight relative">
            📋 Filters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Region Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Region
              </label>
              <select
                value={selectedRegionId || ""}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="w-full p-2 border-2 border-gray-800 bg-white font-['Kalam'] text-sm font-semibold transition-all hover:bg-gray-50"
              >
                <option value="">All Regions ({availableRegions.length})</option>
                {availableRegions.map((region: DropdownOption) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>

            {/* District Dropdown - only show if region is selected */}
            {selectedRegionId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  District
                </label>
                <select
                  value={selectedDistrictId || ""}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full p-2 border-2 border-gray-800 bg-white font-['Kalam'] text-sm font-semibold transition-all hover:bg-gray-50"
                >
                  <option value="">
                    All Districts ({availableDistricts.length})
                  </option>
                  {availableDistricts.map((district: DropdownOption) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Current Filter Display */}
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium">Currently showing:</span>
            <span className="ml-2">
              {selectedDistrictName
                ? `Suburbs in ${selectedDistrictName}`
                : selectedRegionName
                ? `Districts in ${selectedRegionName}`
                : `All regions`}
            </span>
            <span className="ml-2 text-gray-400">
              •{" "}
              {selectedListingType === "HOUSES_TO_BUY"
                ? "houses for sale"
                : "houses for rent"}
            </span>
            <span className="ml-2 text-gray-400">
              • Showing all {displayData.length} results
            </span>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="sketch-box">
        <div className="bg-gray-50 bg-[repeating-linear-gradient(90deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)] p-6 border-b-2 border-gray-800">
          <h3 className="text-2xl font-bold text-gray-800 yellow-highlight relative">
            📋 {levelName}s by Listings
            {selectedRegionName && ` in ${selectedRegionName}`}
            {selectedDistrictName && ` in ${selectedDistrictName}`}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-5 text-left bg-gray-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.03)_5px,rgba(0,0,0,0.03)_10px)] font-bold text-gray-800 text-sm cursor-pointer select-none transition-all hover:bg-gray-100 hover:text-black uppercase tracking-wide border-r border-dashed border-gray-300">
                  Rank
                </th>
                <th
                  className="p-5 text-left bg-gray-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.03)_5px,rgba(0,0,0,0.03)_10px)] font-bold text-gray-800 text-sm cursor-pointer select-none transition-all hover:bg-gray-100 hover:text-black uppercase tracking-wide border-r border-dashed border-gray-300"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>{levelName}</span>
                    <SortIndicator column="name" />
                  </div>
                </th>
                <th
                  className="p-5 text-left bg-gray-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.03)_5px,rgba(0,0,0,0.03)_10px)] font-bold text-gray-800 text-sm cursor-pointer select-none transition-all hover:bg-gray-100 hover:text-black uppercase tracking-wide border-r border-dashed border-gray-300"
                  onClick={() => handleSort("listingCount")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Listings</span>
                    <SortIndicator column="listingCount" />
                  </div>
                </th>
                <th className="p-5 text-left bg-gray-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.03)_5px,rgba(0,0,0,0.03)_10px)] font-bold text-gray-800 text-sm cursor-pointer select-none transition-all hover:bg-gray-100 hover:text-black uppercase tracking-wide border-r border-dashed border-gray-300">
                  % of Total
                </th>
                <th className="p-5 text-left bg-gray-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.03)_5px,rgba(0,0,0,0.03)_10px)] font-bold text-gray-800 text-sm cursor-pointer select-none transition-all hover:bg-gray-100 hover:text-black uppercase tracking-wide">
                  4 Week Trend
                </th>
              </tr>
            </thead>
            <tbody key={`table-${animationKey}`}>
              {displayData.map(
                (item: DatabaseLocationSnapshot, index: number) => {
                  const name: string = getCurrentLocationName(item);
                  const isClickable = currentLevel === "region" || currentLevel === "district";
                  
                  return (
                    <tr
                      key={`${item.id}-${index}-${animationKey}`}
                      className={`cascading-row-${animationKey} table-row transition-all border-b border-dashed border-gray-300`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <td className="p-5 whitespace-nowrap text-sm text-gray-900">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold ${
                            index === 0
                              ? "bg-yellow-500"
                              : index === 1
                              ? "bg-gray-400"
                              : index === 2
                              ? "bg-orange-600"
                              : "bg-gray-300"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="p-5 whitespace-nowrap">
                        <div 
                          className={`text-sm font-bold ${isClickable ? 'clickable-location' : 'text-gray-800'}`}
                          onClick={isClickable ? () => handleLocationClick(item) : undefined}
                        >
                          {name}
                        </div>
                        {currentLevel === "suburb" && (
                          <div className="text-xs text-gray-500">
                            {item.districtName}, {item.regionName}
                          </div>
                        )}
                        {currentLevel === "district" && (
                          <div className="text-xs text-gray-500">
                            {item.regionName}
                          </div>
                        )}
                      </td>
                      <td className="p-5 whitespace-nowrap text-sm text-gray-900 font-bold">
                        {item.listingCount?.toLocaleString()}
                      </td>
                      <td className="p-5 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-6 font-bold p-2 border border-gray-800 transition-all">
                          <span>
                            {(
                              ((item.listingCount || 0) / (filteredTotals?.total || totals.total)) *
                              100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="w-20 h-8 relative border border-dashed border-gray-300 bg-gray-50">
                          <div className="w-full h-full bg-gray-800 opacity-20"></div>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}