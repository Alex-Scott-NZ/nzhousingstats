// src\app\components\Header.tsx
"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import styles from "./PropertyDashboard.module.scss";

// Add isomorphic layout effect hook
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface HeaderProps {
  lastUpdated?: string;
}

export default function Header({ lastUpdated }: HeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Use isomorphic effect for hydration
  useIsomorphicLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Date formatting function with hydration protection
  const formatDate = (dateString: string) => {
    if (!mounted) {
      // Don't show anything during SSR
      return "";
    }

    // Client-side formatting only
    return new Date(dateString).toLocaleString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {/* Header */}
      <div className={styles["sketch-box"]}>
        <div className="p-4 sm:p-6 pb-3 sm:pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-left text-gray-800 relative uppercase">
            <Link href="/" className="block w-full">
              <div className="flex items-center">
                <span className={styles["house-icon"]}>🏠</span>
                <div className="mt-1">
                  <span className={styles["yellow-highlight"]}>
                    PROPERTY LISTINGS TRACKER
                  </span>
                </div>
              </div>
            </Link>
          </h1>
        </div>
        <div className="px-4 sm:px-6 pb-3 sm:pb-4 border-t border-dashed border-gray-300">
          <div className="text-xs flex items-baseline justify-between pt-3 text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse"></div>
              <span className="font-semibold uppercase tracking-wide">
                LAST UPDATED:{" "}
                <span className="font-bold text-gray-700">
                  {lastUpdated ? formatDate(lastUpdated) : "Loading..."}
                </span>
              </span>
            </div>
            <button
              onClick={() => setShowAboutModal(true)}
              className="font-bold px-2 py-1 border-2 border-gray-800 hover:bg-gray-800 hover:text-white text-gray-800 uppercase transition-all duration-200 text-xs"
            >
              ABOUT
            </button>
          </div>
        </div>
      </div>

      {/* About Modal */}
      {showAboutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAboutModal(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div
            className="relative bg-white border-4 border-black shadow-[8px_8px_0px_#000] max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAboutModal(false)}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center border-2 border-black hover:bg-black hover:text-white transition-all duration-200 font-bold"
            >
              ✕
            </button>
            <div className="mb-4">
              <h3 className="text-2xl font-bold uppercase text-black border-b-2 border-dashed border-gray-300 pb-2">
                🏠 ABOUT
              </h3>
            </div>
            <div className="space-y-4 text-gray-700">
              <p className="font-semibold">
                NZ Housing Stats tracks property market trends across New
                Zealand.
              </p>
              <p className="text-sm">
                Data is updated daily and covers all regions, districts, and
                suburbs with comprehensive market insights.
              </p>
              <div className="bg-[#fe90e8] border-2 border-black p-3 -mx-2">
                <p className="text-sm font-bold text-black mb-2">
                  🚧 BETA VERSION
                </p>
                <p className="text-xs text-black">
                  This site is currently in beta testing. Some features may be
                  incomplete or show inconsistent data while we collect more
                  information. We're working to improve accuracy and add new
                  features.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-300">
              <button
                onClick={() => setShowAboutModal(false)}
                className="w-full px-4 py-2 border-2 border-gray-800 bg-gray-800 text-white font-bold uppercase hover:bg-white hover:text-gray-800 transition-all duration-200"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
