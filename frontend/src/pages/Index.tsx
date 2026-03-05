import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Map, GitBranch, Server, MessageSquare, Route, MapPin } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import NodeDetailsSidebar from "@/components/dashboard/NodeDetailsSidebar";
import MapView from "@/components/dashboard/MapView";
import TopologyView from "@/components/dashboard/TopologyView";
import ExtendedNodeView from "@/components/dashboard/ExtendedNodeView";
import MessagesView from "@/components/dashboard/MessagesView";
import RouteAnalysis from "@/components/dashboard/RouteAnalysis";
import OfflineMapView from "@/components/dashboard/OfflineMapView";
import { useNodesContext } from "@/contexts/NodesContext";

const tabs = [
  { value: "offline-map", label: "Offline Map", icon: MapPin },
  { value: "map", label: "Map View", icon: Map },
  { value: "topology", label: "Topology", icon: GitBranch },
  { value: "nodes", label: "Nodes", icon: Server },
  { value: "messages", label: "Messages", icon: MessageSquare },
  { value: "routes", label: "Routes", icon: Route },
];

const Index = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { nodes } = useNodesContext();

  // Check if COM port is selected, redirect to init screen if not
  useEffect(() => {
    const selectedComPort = localStorage.getItem('selectedComPort');
    if (!selectedComPort) {
      navigate('/');
    }
  }, [navigate]);

  // Set the first node as selected when nodes are loaded
  useEffect(() => {
    if (nodes.length > 0 && !selectedNodeId) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes, selectedNodeId]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Persistent SDN Node Sidebar */}
      <NodeDetailsSidebar selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
              <ExtendedNodeView selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            </TabsContent>
            <TabsContent value="messages" className="h-full m-0">
              <MessagesView />
            </TabsContent>
            <TabsContent value="routes" className="h-full m-0">
              <RouteAnalysis />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
