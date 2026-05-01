// Link Quality Report types matching backend SDN packet format

export interface LinkQualityReport {
  report_id?: number;
  reporter: string; // Hex node ID (e.g., "0x6d8c490")
  reporter_node_id?: number; // Numeric node ID (e.g., 114869392)
  relay_nodes: string[]; // Array of hex relay node IDs
  rx_good: number[]; // Received good packets per relay
  rx_bad: number[]; // Received bad packets per relay
  channel_util: number; // Channel utilization percentage reported by packet (0-100)
  air_util_tx: number; // Air utilization TX percentage reported by packet (0-100)
  timestamp: string; // ISO timestamp
  last_heard?: number; // Unix timestamp
}

export interface RelayNodeQuality {
  nodeId: string;
  rxGood: number;
  rxBad: number;
  total: number;
  quality: number; // Percentage (0-100)
}

export interface NetworkQualityStats {
  avgQuality: number;
  totalRelays: number;
  avgChannelUtil: number;
  avgAirUtilTx: number;
  reportsCount: number;
}
