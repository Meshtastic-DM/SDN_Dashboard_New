import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Map, GitBranch, Server, MessageSquare, Route, MapPin, Activity, Send } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import NodeDetailsSidebar from "@/components/dashboard/NodeDetailsSidebar";
import MapView from "@/components/dashboard/MapView";
import TopologyView from "@/components/dashboard/TopologyView";
import ExtendedNodeView from "@/components/dashboard/ExtendedNodeView";
import MessagesView from "@/components/dashboard/MessagesView";
import RouteAnalysis from "@/components/dashboard/RouteAnalysis";
import RouteInstallPanel from "@/components/dashboard/RouteInstallPanel";
import OfflineMapView from "@/components/dashboard/OfflineMapView";
import NetworkQuality from "@/components/dashboard/NetworkQuality";
import AdminModal from "@/components/dashboard/AdminModal";
import { useNodesContext } from "@/contexts/NodesContext";
import { MessagesProvider } from "@/contexts/MessagesContext";
import { useMeshtasticConnectionStatus } from "@/hooks/useMeshtasticConnection";
import { DeviceDisconnectionOverlay } from "@/components/DeviceDisconnectionOverlay";

const tabs = [
  { value: "offline-map", label: "Offline Map", icon: MapPin },
  { value: "topology", label: "Topology", icon: GitBranch },
  { value: "nodes", label: "Nodes", icon: Server },
  { value: "messages", label: "Messages", icon: MessageSquare },
  { value: "routes", label: "Routes", icon: Route },
  { value: "route-install", label: "Route Install", icon: Send },
  { value: "network-quality", label: "Network Quality", icon: Activity },
];

const Index = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const navigate = useNavigate();
  const { nodes, selfNodeId } = useNodesContext();
  const { status: deviceStatus } = useMeshtasticConnectionStatus();

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  // Check if COM port is selected, redirect to init screen if not
  useEffect(() => {
    const selectedComPort = localStorage.getItem('selectedComPort');
    if (!selectedComPort) {
      navigate('/');
    }
  }, [navigate]);

  // Auto-select the connected node (selfNodeId) on initial load only
  useEffect(() => {
    // Only set default if nothing is selected yet
    if (!selectedNodeId && nodes.length > 0) {
      if (selfNodeId) {
        // Try to select self node first
        const selfNode = nodes.find(n => n.id.slice(-7) === selfNodeId.slice(-7));
        if (selfNode) {
          setSelectedNodeId(selfNode.id);
        } else {
          // Fallback to first node if self not found
          setSelectedNodeId(nodes[0].id);
        }
      } else {
        // No selfNodeId, select first node
        setSelectedNodeId(nodes[0].id);
      }
    }
  }, [nodes, selfNodeId, selectedNodeId]);

  const isDeviceConnected = deviceStatus?.connected ?? true;

  return (
    <>
      {/* Device Disconnection Overlay - rendered at top level */}
      {!isDeviceConnected && deviceStatus && (
        <DeviceDisconnectionOverlay
          message={deviceStatus.message}
          port={deviceStatus.port}
          onRetry={() => navigate('/')}
        />
      )}

      <MessagesProvider>
        <div className={`flex h-screen w-full overflow-hidden bg-background ${!isDeviceConnected ? 'pointer-events-none opacity-50' : ''}`}>
          {/* Persistent SDN Node Sidebar */}
          <NodeDetailsSidebar selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
        <DashboardHeader />

        <Tabs defaultValue="offline-map" className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border bg-card px-4">
            <TabsList className="bg-transparent h-10 gap-1">
              {tabs.map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="font-mono text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:glow-green data-[state=active]:border-primary/30 data-[state=active]:border rounded-md px-3 py-1.5 text-muted-foreground hover:text-card-foreground transition-all gap-1.5"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden p-4">
            <TabsContent value="offline-map" className="h-full m-0">
              <OfflineMapView selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            </TabsContent>
            <TabsContent value="map" className="h-full m-0">
              <MapView selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            </TabsContent>
            <TabsContent value="topology" className="h-full m-0">
              <TopologyView selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            </TabsContent>
            <TabsContent value="nodes" className="h-full m-0">
              <ExtendedNodeView selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} onAdminClick={() => setAdminModalOpen(true)} />
            </TabsContent>
            <TabsContent value="messages" className="h-full m-0">
              <MessagesView />
            </TabsContent>
            <TabsContent value="routes" className="h-full m-0">
              <RouteAnalysis />
            </TabsContent>
            <TabsContent value="route-install" className="h-full m-0">
              <RouteInstallPanel selectedNodeId={selectedNodeId} />
            </TabsContent>
            <TabsContent value="network-quality" className="h-full m-0">
              <NetworkQuality />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
    
    {/* Admin Modal */}
    <AdminModal isOpen={adminModalOpen} onOpenChange={setAdminModalOpen} selectedNode={selectedNode} />
    </MessagesProvider>
    </>
  );
};

export default Index;
