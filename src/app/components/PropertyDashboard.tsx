// src\app\components\PropertyDashboard.tsx
"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
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
  historicalData: HistoricalSnapshot[]; // Add this
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
  const [showAll, setShowAll] = useState<boolean>(false);

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

  // Sort and limit data
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

    return showAll ? sorted : sorted.slice(0, 10);
  }, [currentDisplayData, sortBy, sortOrder, showAll]);

  // Determine what we're showing
  const getCurrentLevel = (): LocationLevel => {
    if (selectedDistrictId) return "suburb";
    if (selectedRegionId) return "district";
    return "region";
  };

  const currentLevel: LocationLevel = getCurrentLevel();
  const levelName: string =
    currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);

  // Get current location name for display - FIXED VERSION
  const getCurrentLocationName = (item: DatabaseLocationSnapshot): string => {
    // Show the appropriate name based on what level we're currently viewing
    if (currentLevel === "region") {
      return item.regionName || "Unknown Region";
    } else if (currentLevel === "district") {
      return item.districtName || "Unknown District"; // Show district name when viewing districts
    } else if (currentLevel === "suburb") {
      return item.suburbName || "Unknown Suburb"; // Show suburb name when viewing suburbs
    }
    return "Unknown";
  };

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
    <div className="space-y-6">
      {/* NEW: Market Trends Section - UPDATED WITH RECHARTS */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl shadow-lg">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            🏠 NZ Housing Market Trends
          </h2>
          <p className="text-gray-600">
            Real-time property listings across New Zealand
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Total Card - REPLACED TREMOR CARD */}
          <div className="bg-white/80 backdrop-blur rounded-lg p-6 shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {totals?.total.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 mt-1">Total Listings</p>
              </div>
              {changeMetrics && (
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    changeMetrics.deltaType === "increase"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {changeMetrics.change > 0 ? "+" : ""}
                  {changeMetrics.change.toLocaleString()} (
                  {changeMetrics.changePercent.toFixed(1)}%)
                </div>
              )}
            </div>
          </div>

          {/* Trend Chart - UPDATED TO BAR CHART */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur rounded-lg p-6 shadow">
            <p className="text-sm text-gray-600 mb-4 font-medium">
              Listings Over Time
            </p>
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={128}>
                <BarChart
                  data={trendData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      "Listings",
                    ]}
                    labelStyle={{ color: "#374151" }}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "14px",
                    }}
                  />
                  <Bar
                    dataKey="listings"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-500">
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

        {/* Data Points Summary */}
        {trendData.length > 0 && (
          <div className="mt-4 p-4 bg-white/60 rounded-lg">
            <p className="text-sm text-gray-600">
              📅 Data Points: {trendData.length} snapshots
              {trendData.length > 1 && (
                <span>
                  • Range: {trendData[0].fullDate} to{" "}
                  {trendData[trendData.length - 1].fullDate}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Total Listings</h3>
          <p className="text-3xl font-bold text-blue-600">
            {totals.total.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">
            {selectedListingType === "HOUSES_TO_BUY"
              ? "houses for sale"
              : "houses for rent"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Current View</h3>
          <p className="text-3xl font-bold text-green-600">
            {displayData.length}
          </p>
          <p className="text-sm text-gray-500">{levelName}s showing</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Available</h3>
          <p className="text-3xl font-bold text-orange-600">
            {currentDisplayData.length}
          </p>
          <p className="text-sm text-gray-500">Total {levelName}s</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">All Suburbs</h3>
          <p className="text-3xl font-bold text-purple-600">{totals.suburbs}</p>
          <p className="text-sm text-gray-500">Individual suburbs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Listing Type - simplified to just Buy/Rent */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Property Type
            </label>
            <select
              value={selectedListingType}
              onChange={(e) => {
                setSelectedListingType(e.target.value as HouseListingType);
                setSelectedRegionId(null);
                setSelectedDistrictId(null);
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="HOUSES_TO_BUY">🏠 Houses to Buy</option>
              <option value="HOUSES_TO_RENT">🏡 Houses to Rent</option>
            </select>
          </div>

          {/* Region Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Region
            </label>
            <select
              value={selectedRegionId || ""}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700">
                District
              </label>
              <select
                value={selectedDistrictId || ""}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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

          {/* Show All Toggle */}
          <div className="flex items-end">
            <button
              onClick={() => setShowAll(!showAll)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                showAll
                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                  : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
              }`}
            >
              {showAll
                ? `Showing All (${currentDisplayData.length})`
                : `Top 10 of ${currentDisplayData.length}`}
            </button>
          </div>
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
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          {levelName}s by Listings
          {selectedRegionName && ` in ${selectedRegionName}`}
          {selectedDistrictName && ` in ${selectedDistrictName}`}
        </h3>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>{levelName}</span>
                    <SortIndicator column="name" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort("listingCount")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Listings</span>
                    <SortIndicator column="listingCount" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayData.map(
                (item: DatabaseLocationSnapshot, index: number) => {
                  const name: string = getCurrentLocationName(item);
                  return (
                    <tr
                      key={item.id}
                      className={index < 3 ? "bg-yellow-50" : ""}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {name}
                        </div>
                        {/* Show parent location info for suburbs */}
                        {currentLevel === "suburb" && (
                          <div className="text-xs text-gray-500">
                            {item.districtName}, {item.regionName}
                          </div>
                        )}
                        {/* Show parent location info for districts */}
                        {currentLevel === "district" && (
                          <div className="text-xs text-gray-500">
                            {item.regionName}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                        {item.listingCount?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <span className="mr-2">
                            {(
                              ((item.listingCount || 0) / totals.total) *
                              100
                            ).toFixed(1)}
                            %
                          </span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${
                                  ((item.listingCount || 0) / totals.total) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
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

      {/* Recent Collections */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Recent Data Collections
        </h3>
        <div className="space-y-3">
          {snapshots
            .slice(0, 5)
            .map((snapshot: DatabaseWeeklySnapshot, index: number) => (
              <div
                key={snapshot.id}
                className={`flex justify-between items-center p-4 rounded-lg ${
                  index === 0
                    ? "bg-green-50 border border-green-200"
                    : "bg-gray-50"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      index === 0 ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <div>
                    <span className="font-medium text-gray-900">
                      {snapshot.listingType.replace(/_/g, " ")}
                    </span>
                    <div className="text-sm text-gray-500">
                      {new Date(snapshot.collectedAt).toLocaleString("en-NZ")}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600">
                    {snapshot.totalNzListings.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">listings</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
