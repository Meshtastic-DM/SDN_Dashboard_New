import { useEffect, useState } from "react";
import { LinkQualityReport, NetworkQualityStats } from "@/types/linkQuality";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface LinkQualityResponse {
  stats: NetworkQualityStats;
  reports: LinkQualityReport[];
}

export function useLinkQuality(
  refreshInterval: number = 5000,
  limit: number = 100,
  reporter?: string
) {
  const [data, setData] = useState<LinkQualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLinkQuality = async () => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
      });

      if (reporter) {
        params.append("reporter", reporter);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/link-quality/reports?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();
      setData(jsonData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch link quality data");
      console.error("Error fetching link quality:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLinkQuality();

    // Set up polling if refreshInterval is provided
    if (refreshInterval > 0) {
      const interval = setInterval(fetchLinkQuality, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, limit, reporter]);

  return {
    reports: data?.reports || [],
    stats: data?.stats || {
      avg_quality: 0,
      total_relays: 0,
      avg_channel_util: 0,
      avg_air_util_tx: 0,
      reports_count: 0,
    },
    loading,
    error,
    refetch: fetchLinkQuality,
  };
}
