import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Power, Radio, MapPin, Clock, Waves, Settings, ShieldCheck } from "lucide-react";
import DeviceControlPanel from "./AdminPanels/DeviceControlPanel";
import NodeManagementPanel from "./AdminPanels/NodeManagementPanel";
import NodeRolePanel from "./AdminPanels/NodeRolePanel";
import PositionPanel from "./AdminPanels/PositionPanel";
import OwnerPanel from "./AdminPanels/OwnerPanel";
import TimePanel from "./AdminPanels/TimePanel";
import ConfigPanel from "./AdminPanels/ConfigPanel";
import LoraConfigPanel from "./AdminPanels/LoraConfigPanel";
import { NodeDisplayData } from "@/types/nodes";

interface Props {
  selectedNode: NodeDisplayData;
}

export default function RemoteAdminPanel({ selectedNode }: Props) {
  const [activeTab, setActiveTab] = useState("device-control");

  const tabs = [
    {
      value: "device-control",
      label: "Device",
      icon: Power,
      component: DeviceControlPanel,
    },
    {
      value: "node-management",
      label: "Nodes",
      icon: Radio,
      component: NodeManagementPanel,
    },
    {
      value: "node-role-setting",
      label: "Node Role Setting",
      icon: ShieldCheck,
      component: NodeRolePanel,
    },
    {
      value: "position",
      label: "Position",
      icon: MapPin,
      component: PositionPanel,
    },
    {
      value: "owner",
      label: "Owner",
      icon: Waves,
      component: OwnerPanel,
    },
    {
      value: "time",
      label: "Time",
      icon: Clock,
      component: TimePanel,
    },
    {
      value: "config",
      label: "Config",
      icon: Settings,
      component: ConfigPanel,
    },
    {
      value: "lora-config",
      label: "LoRa",
      icon: Radio,
      component: LoraConfigPanel,
    },
  ];

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 border-b border-border rounded-none p-2 justify-start">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs font-mono px-2 py-1 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <Icon className="h-3 w-3 mr-1" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => {
          const Component = tab.component;
          return (
            <TabsContent key={tab.value} value={tab.value} className="p-3 space-y-3">
              <Component selectedNode={selectedNode} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
