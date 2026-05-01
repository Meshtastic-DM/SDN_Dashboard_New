import { useState } from "react";
import { Activity, Signal, Radio, TrendingUp, AlertCircle, RefreshCw, ChevronLeft } from "lucide-react";
import { LinkQualityReport } from "@/types/linkQuality";
import { useLinkQuality } from "@/hooks/useLinkQuality";

const calculateRelayQuality = (rxGood: number, rxBad: number): number => {
  const total = rxGood + rxBad;
  return total > 0 ? (rxGood / total) * 100 : 0;
};

const utilizationBarWidth = (utilizationPercent: number): string => {
  return `${Math.min(Math.max(utilizationPercent, 0), 100)}%`;
};

const formatUtilizationValue = (utilizationPercent: number): string => {
  return utilizationPercent.toFixed(2);
};

const getQualityColor = (quality: number): string => {
  if (quality >= 80) return "text-green-500";
  if (quality >= 60) return "text-yellow-500";
  return "text-red-500";
};

const getQualityBgColor = (quality: number): string => {
  if (quality >= 80) return "bg-green-500";
  if (quality >= 60) return "bg-yellow-500";
  return "bg-red-500";
};

export default function NetworkQuality() {
  const { reports, stats, loading, error, refetch } = useLinkQuality(5000, 100);
  const [selectedReport, setSelectedReport] = useState<LinkQualityReport | null>(null);
  const [selectedReporter, setSelectedReporter] = useState<string | null>(null);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatNodeId = (id: string) => {
    return id.startsWith("0x") ? id : `0x${id}`;
  };

  // Group reports by reporter node
  const reportsByReporter = reports.reduce((acc, report) => {
    const reporter = report.reporter;
    if (!acc[reporter]) {
      acc[reporter] = [];
    }
    acc[reporter].push(report);
    return acc;
  }, {} as Record<string, LinkQualityReport[]>);

  // Get unique reporter nodes sorted by most recent report
  const uniqueReporters = Object.entries(reportsByReporter)
    .map(([reporter, reportsArray]) => ({
      reporter,
      reportCount: reportsArray.length,
      lastReport: reportsArray[0],
      avgQuality: (() => {
        let totalQuality = 0;
        let measurementCount = 0;
        
        reportsArray.forEach(report => {
          for (let i = 0; i < report.rx_good.length; i++) {
            totalQuality += calculateRelayQuality(report.rx_good[i], report.rx_bad[i]);
            measurementCount += 1;
          }
        });
        
        return measurementCount > 0 ? totalQuality / measurementCount : 0;
      })(),
    }))
    .sort((a, b) => new Date(b.lastReport.timestamp).getTime() - new Date(a.lastReport.timestamp).getTime());

  // Filter reports by selected reporter
  const filteredReports = selectedReporter ? reportsByReporter[selectedReporter] || [] : [];

  // Auto-select first report when viewing a reporter's reports
  if (selectedReporter && !selectedReport && filteredReports.length > 0) {
    setSelectedReport(filteredReports[0]);
  }

  return (
    <div className="h-full flex gap-4">
      {/* Left Panel */}
      <div className="w-80 flex flex-col gap-4">
        {/* Network Stats Summary */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-mono text-sm font-semibold text-card-foreground">
                NETWORK OVERVIEW
              </h3>
            </div>
            <button
              onClick={() => refetch()}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {error && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-500 font-mono">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded p-3">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">AVG QUALITY</div>
              <div className={`text-xl font-bold font-mono ${getQualityColor(stats.avg_quality)}`}>
                {stats.avg_quality.toFixed(1)}%
              </div>
            </div>
            <div className="bg-muted/50 rounded p-3">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">RELAY NODES</div>
              <div className="text-xl font-bold font-mono text-primary">
                {stats.total_relays}
              </div>
            </div>
            <div className="bg-muted/50 rounded p-3">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">CHANNEL UTIL</div>
              <div className="text-xl font-bold font-mono text-blue-500">
                {formatUtilizationValue(stats.avg_channel_util)}
              </div>
            </div>
            <div className="bg-muted/50 rounded p-3">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">AIR TX UTIL</div>
              <div className="text-xl font-bold font-mono text-purple-500">
                {formatUtilizationValue(stats.avg_air_util_tx)}
              </div>
            </div>
          </div>
        </div>

        {/* Reporter Nodes or Reports List */}
        <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedReporter && (
                <button
                  onClick={() => {
                    setSelectedReporter(null);
                    setSelectedReport(null);
                  }}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Back to reporters"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <Signal className="h-4 w-4 text-secondary" />
              <h3 className="font-mono text-sm font-semibold text-card-foreground">
                {selectedReporter ? (
                  <span>REPORTS FROM {formatNodeId(selectedReporter)}</span>
                ) : (
                  <span>REPORTER NODES ({uniqueReporters.length})</span>
                )}
              </h3>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading && uniqueReporters.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground font-mono text-xs">
                Loading reporters...
              </div>
            ) : selectedReporter ? (
              // Reports from selected reporter
              filteredReports.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground font-mono text-xs">
                  No reports from this reporter
                </div>
              ) : (
                filteredReports.map(report => {
                  const avgQuality = report.rx_good.reduce((sum, good, idx) => 
                    sum + calculateRelayQuality(good, report.rx_bad[idx]), 0
                  ) / report.rx_good.length;

                  return (
                    <div
                      key={report.report_id}
                      onClick={() => setSelectedReport(report)}
                      className={`p-3 border-b border-border cursor-pointer transition-colors ${
                        selectedReport?.report_id === report.report_id
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                          {report.relay_nodes.length} relays
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {formatTimestamp(report.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-sm font-bold font-mono ${getQualityColor(avgQuality)}`}>
                          {avgQuality.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              // Reporter nodes list
              uniqueReporters.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground font-mono text-xs">
                  No reporter nodes available
                </div>
              ) : (
                uniqueReporters.map(({ reporter, reportCount, lastReport, avgQuality }) => (
                  <div
                    key={reporter}
                    onClick={() => {
                      setSelectedReporter(reporter);
                      setSelectedReport(null);
                    }}
                    className={`p-4 border-b border-border cursor-pointer transition-colors ${
                      selectedReporter === reporter
                        ? "bg-primary/10 border-l-2 border-l-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-semibold text-primary">
                        {formatNodeId(reporter)}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground px-2 py-1 bg-muted rounded">
                        {reportCount} {reportCount === 1 ? "report" : "reports"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className={`text-sm font-bold font-mono ${getQualityColor(avgQuality)}`}>
                        Avg: {avgQuality.toFixed(1)}%
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatTimestamp(lastReport.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Detailed View */}
      <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
        {selectedReport ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="font-mono text-lg font-bold text-card-foreground">
                    Link Quality Report
                  </h2>
                  <p className="text-xs font-mono text-muted-foreground mt-1">
                    Reporter: {formatNodeId(selectedReport.reporter)} 
                    {selectedReport.reporter_node_id && ` (Node ${selectedReport.reporter_node_id})`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-muted-foreground">TIMESTAMP</div>
                  <div className="text-sm font-mono text-card-foreground">
                    {formatTimestamp(selectedReport.timestamp)}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {/* Relay Nodes Quality Table */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="h-4 w-4 text-primary" />
                  <h3 className="font-mono text-sm font-semibold text-card-foreground">
                    RELAY NODES QUALITY
                  </h3>
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-[10px] font-mono font-semibold text-muted-foreground">
                          NODE ID
                        </th>
                        <th className="text-right p-3 text-[10px] font-mono font-semibold text-muted-foreground">
                          RX GOOD
                        </th>
                        <th className="text-right p-3 text-[10px] font-mono font-semibold text-muted-foreground">
                          RX BAD
                        </th>
                        <th className="text-right p-3 text-[10px] font-mono font-semibold text-muted-foreground">
                          TOTAL
                        </th>
                        <th className="text-right p-3 text-[10px] font-mono font-semibold text-muted-foreground">
                          QUALITY
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReport.relay_nodes.map((nodeId, idx) => {
                        const good = selectedReport.rx_good[idx];
                        const bad = selectedReport.rx_bad[idx];
                        const total = good + bad;
                        const quality = calculateRelayQuality(good, bad);

                        return (
                          <tr key={nodeId} className="border-t border-border hover:bg-muted/30">
                            <td className="p-3 font-mono text-xs font-semibold text-primary">
                              {formatNodeId(nodeId)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm text-green-500">
                              {good}
                            </td>
                            <td className="p-3 text-right font-mono text-sm text-red-500">
                              {bad}
                            </td>
                            <td className="p-3 text-right font-mono text-sm text-card-foreground">
                              {total}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full ${getQualityBgColor(quality)} transition-all`}
                                    style={{ width: `${quality}%` }}
                                  />
                                </div>
                                <span className={`font-mono text-sm font-bold ${getQualityColor(quality)}`}>
                                  {quality.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Utilization Metrics */}
              <div className="grid grid-cols-2 gap-4">
                {/* Channel Utilization */}
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <h3 className="font-mono text-xs font-semibold text-card-foreground">
                      CHANNEL UTILIZATION
                    </h3>
                  </div>
                  <div className="mb-2">
                    <div className="text-3xl font-bold font-mono text-blue-500">
                      {formatUtilizationValue(selectedReport.channel_util)}
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: utilizationBarWidth(selectedReport.channel_util) }}
                    />
                  </div>
                </div>

                {/* Air Utilization TX */}
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Radio className="h-4 w-4 text-purple-500" />
                    <h3 className="font-mono text-xs font-semibold text-card-foreground">
                      AIR UTILIZATION TX
                    </h3>
                  </div>
                  <div className="mb-2">
                    <div className="text-3xl font-bold font-mono text-purple-500">
                      {formatUtilizationValue(selectedReport.air_util_tx)}
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: utilizationBarWidth(selectedReport.air_util_tx) }}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="rounded-lg border border-border p-4 bg-blue-500/5 border-blue-500/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-mono text-xs font-semibold text-card-foreground mb-1">
                      REPORT DETAILS
                    </h4>
                    <div className="text-xs font-mono text-muted-foreground space-y-1">
                      <div>Reporter Node ID: {selectedReport.reporter_node_id}</div>
                      <div>Total Relay Nodes: {selectedReport.relay_nodes.length}</div>
                      <div>Timestamp: {new Date(selectedReport.timestamp).toLocaleString()}</div>
                      {selectedReport.last_heard && (
                        <div>Last Heard: {new Date(selectedReport.last_heard * 1000).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono text-sm">
            Select a report to view details
          </div>
        )}
      </div>
    </div>
  );
}
