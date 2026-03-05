export interface SDNNode {
  id: string;
  name: string;
  ip: string;
  mac: string;
  status: "online" | "offline" | "warning";
  type: "switch" | "router" | "controller" | "host";
  port: number;
  x: number;
  y: number;
  uptime: string;
  throughput: string;
  latency: string;
  packetLoss: string;
  connections: string[];
}

export const mockNodes: SDNNode[] = [
  {
    id: "s1", name: "Switch-01", ip: "10.0.0.1", mac: "00:1A:2B:3C:4D:01",
    status: "online", type: "switch", port: 6633, x: 200, y: 150,
    uptime: "14d 7h 23m", throughput: "1.2 Gbps", latency: "2.1ms", packetLoss: "0.01%",
    connections: ["s2", "s3", "c1"],
  },
  {
    id: "s2", name: "Switch-02", ip: "10.0.0.2", mac: "00:1A:2B:3C:4D:02",
    status: "online", type: "switch", port: 6633, x: 400, y: 100,
    uptime: "14d 7h 23m", throughput: "890 Mbps", latency: "1.8ms", packetLoss: "0.02%",
    connections: ["s1", "s4", "r1"],
  },
  {
    id: "s3", name: "Switch-03", ip: "10.0.0.3", mac: "00:1A:2B:3C:4D:03",
    status: "warning", type: "switch", port: 6633, x: 200, y: 300,
    uptime: "3d 12h 05m", throughput: "450 Mbps", latency: "5.2ms", packetLoss: "1.2%",
    connections: ["s1", "s4", "h1"],
  },
  {
    id: "s4", name: "Switch-04", ip: "10.0.0.4", mac: "00:1A:2B:3C:4D:04",
    status: "online", type: "switch", port: 6633, x: 400, y: 300,
    uptime: "14d 7h 23m", throughput: "1.5 Gbps", latency: "1.5ms", packetLoss: "0.00%",
    connections: ["s2", "s3", "h2"],
  },
  {
    id: "r1", name: "Router-01", ip: "10.0.1.1", mac: "00:1A:2B:3C:4D:10",
    status: "online", type: "router", port: 6633, x: 550, y: 100,
    uptime: "30d 2h 11m", throughput: "2.4 Gbps", latency: "1.0ms", packetLoss: "0.00%",
    connections: ["s2", "c1"],
  },
  {
    id: "c1", name: "Controller", ip: "10.0.2.1", mac: "00:1A:2B:3C:4D:20",
    status: "online", type: "controller", port: 8080, x: 350, y: 50,
    uptime: "30d 2h 11m", throughput: "500 Mbps", latency: "0.5ms", packetLoss: "0.00%",
    connections: ["s1", "r1"],
  },
  {
    id: "h1", name: "Host-01", ip: "10.0.3.1", mac: "00:1A:2B:3C:4D:30",
    status: "online", type: "host", port: 0, x: 100, y: 380,
    uptime: "7d 18h 44m", throughput: "100 Mbps", latency: "3.2ms", packetLoss: "0.05%",
    connections: ["s3"],
  },
  {
    id: "h2", name: "Host-02", ip: "10.0.3.2", mac: "00:1A:2B:3C:4D:31",
    status: "offline", type: "host", port: 0, x: 500, y: 380,
    uptime: "0d 0h 0m", throughput: "0 Mbps", latency: "—", packetLoss: "—",
    connections: ["s4"],
  },
];

export interface Message {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  type: "info" | "warning" | "error" | "packet";
  content: string;
}

export const mockMessages: Message[] = [
  { id: "m1", from: "c1", to: "s1", timestamp: "14:23:01", type: "info", content: "Flow table updated — 12 new rules pushed" },
  { id: "m2", from: "s3", to: "c1", timestamp: "14:23:05", type: "warning", content: "Port 3 flapping detected — threshold exceeded" },
  { id: "m3", from: "s1", to: "s2", timestamp: "14:23:12", type: "packet", content: "LLDP discovery packet — topology refresh" },
  { id: "m4", from: "h2", to: "s4", timestamp: "14:23:18", type: "error", content: "Connection timeout — host unreachable" },
  { id: "m5", from: "r1", to: "s2", timestamp: "14:23:25", type: "info", content: "BGP session established — AS 65001" },
  { id: "m6", from: "c1", to: "s4", timestamp: "14:23:30", type: "info", content: "QoS policy applied — priority queue enabled" },
  { id: "m7", from: "s2", to: "s4", timestamp: "14:23:45", type: "packet", content: "ARP request broadcast — who has 10.0.3.2?" },
  { id: "m8", from: "s3", to: "c1", timestamp: "14:24:01", type: "warning", content: "Buffer utilization at 78% — approaching limit" },
];

export interface RouteEntry {
  id: string;
  source: string;
  destination: string;
  path: string[];
  hops: number;
  latency: string;
  bandwidth: string;
  status: "active" | "backup" | "failed";
}

export const mockRoutes: RouteEntry[] = [
  { id: "rt1", source: "h1", destination: "h2", path: ["h1", "s3", "s4", "h2"], hops: 3, latency: "8.4ms", bandwidth: "100 Mbps", status: "active" },
  { id: "rt2", source: "h1", destination: "r1", path: ["h1", "s3", "s1", "s2", "r1"], hops: 4, latency: "12.3ms", bandwidth: "450 Mbps", status: "active" },
  { id: "rt3", source: "h1", destination: "h2", path: ["h1", "s3", "s1", "s2", "s4", "h2"], hops: 5, latency: "14.1ms", bandwidth: "890 Mbps", status: "backup" },
  { id: "rt4", source: "h2", destination: "c1", path: ["h2", "s4", "s2", "r1", "c1"], hops: 4, latency: "—", bandwidth: "0 Mbps", status: "failed" },
  { id: "rt5", source: "r1", destination: "s3", path: ["r1", "s2", "s1", "s3"], hops: 3, latency: "9.1ms", bandwidth: "450 Mbps", status: "active" },
];
