import { useMutation } from "@tanstack/react-query";
import { trackedAdminFetch } from "@/hooks/adminActivity";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function buildApiError(response: Response, fallback: string): Promise<Error> {
  let detail = "";
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") {
      detail = data.detail;
    } else if (data?.detail !== undefined) {
      detail = JSON.stringify(data.detail);
    } else if (typeof data?.message === "string") {
      detail = data.message;
    } else {
      detail = JSON.stringify(data);
    }
  } catch {
    detail = await response.text().catch(() => "");
  }

  if (response.status === 504) {
    return new Error(
      "LoRa config request timed out. Node is reachable, but no admin config response was returned."
    );
  }

  return new Error(detail || fallback || `HTTP ${response.status}`);
}

export interface AdminResponse {
  status: string;
  details: Record<string, any>;
  message?: string;
}

export interface LoraConfigPayload {
  region?: number;
  modemPreset?: number;
  txPower?: number;
  channelNum?: number;
  bandwidth?: number;
  spreadFactor?: number;
  codingRate?: number;
  frequencyOffset?: number;
  overrideFrequency?: number;
  txEnabled?: boolean;
  ignoreMqtt?: boolean;
}

// Owner Management
export const useSetOwner = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      longName: string;
      shortName: string;
      isLicensed: boolean;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/owner/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          owner: {
            long_name: data.longName,
            short_name: data.shortName,
            is_licensed: data.isLicensed,
          },
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? true,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Owner info updated successfully"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useGetOwner = () => {
  return useMutation({
    mutationFn: async (data: { targetNode: string; channelIndex?: number }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/owner/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          channel_index: data.channelIndex ?? 0,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

// Device Control
export const useReboot = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      delaySeconds?: number;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/reboot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          delay_seconds: data.delaySeconds ?? 0,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Reboot command sent"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useShutdown = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      delaySeconds?: number;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/shutdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          delay_seconds: data.delaySeconds ?? 0,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Shutdown command sent"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useFactoryReset = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      resetType?: number;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/factory-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          reset_type: data.resetType ?? 0,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Factory reset command sent"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useNodeDBReset = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      clearFavorites?: boolean;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/nodedb-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          reset_nodedb_and_clear_favorites: data.clearFavorites ?? false,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("NodeDB reset command sent"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

// Node Management
export const useSetFavoriteNode = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      nodeToFavorite: string;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/node/set-favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          node_to_favorite: data.nodeToFavorite,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Node marked as favorite"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useRemoveFavoriteNode = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      nodeToRemove: string;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/node/remove-favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          node_to_remove: data.nodeToRemove,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Node removed from favorites"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useSetIgnoredNode = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      nodeToIgnore: string;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/node/set-ignored`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          node_to_ignore: data.nodeToIgnore,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Node marked as ignored"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useRemoveIgnoredNode = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      nodeToUnignore: string;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/node/remove-ignored`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          node_to_unignore: data.nodeToUnignore,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Node removed from ignored list"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

// Position Management
export const useSetFixedPosition = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      latitude: number;
      longitude: number;
      altitude?: number;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/position/set-fixed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude ?? 0,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Fixed position set successfully"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useRemoveFixedPosition = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/position/remove-fixed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Fixed position removed successfully"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

// Time Management
export const useSetTime = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      timestamp: number;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/time/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          timestamp: data.timestamp,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Time synchronized successfully"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

// Ham Mode
export const useSetHamMode = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      callSign: string;
      shortName: string;
      txPower?: number;
      frequency?: number;
      channelIndex?: number;
      wantAck?: boolean;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/ham-mode/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          ham_params: {
            call_sign: data.callSign,
            short_name: data.shortName,
            tx_power: data.txPower ?? 20,
            frequency: data.frequency ?? 0,
          },
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("Ham mode configured successfully"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

// Configuration Getters
export const useGetConfig = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      configType: number;
      channelIndex?: number;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/config/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          config_type: data.configType,
          channel_index: data.channelIndex ?? 0,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useGetLoraConfig = () => {
  return useMutation({
    mutationFn: async (data: { targetNode: string; channelIndex?: number; wantAck?: boolean; timeoutS?: number }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/config/lora/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? true,
          timeout_s: data.timeoutS ?? 10,
        }),
      });
      if (!response.ok) {
        throw await buildApiError(response, "Failed to load LoRa config");
      }
      return (await response.json()) as AdminResponse;
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useSetLoraConfig = () => {
  return useMutation({
    mutationFn: async (data: {
      targetNode: string;
      loraConfig: LoraConfigPayload;
      channelIndex?: number;
      wantAck?: boolean;
      verifyAfterSet?: boolean;
      timeoutS?: number;
    }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/config/lora/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          lora_config: {
            region: data.loraConfig.region,
            modem_preset: data.loraConfig.modemPreset,
            tx_power: data.loraConfig.txPower,
            channel_num: data.loraConfig.channelNum,
            bandwidth: data.loraConfig.bandwidth,
            spread_factor: data.loraConfig.spreadFactor,
            coding_rate: data.loraConfig.codingRate,
            frequency_offset: data.loraConfig.frequencyOffset,
            override_frequency: data.loraConfig.overrideFrequency,
            tx_enabled: data.loraConfig.txEnabled,
            ignore_mqtt: data.loraConfig.ignoreMqtt,
          },
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? true,
          verify_after_set: data.verifyAfterSet ?? true,
          timeout_s: data.timeoutS ?? 10,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onSuccess: () => toast.success("LoRa config update sent successfully"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useGetDeviceMetadata = () => {
  return useMutation({
    mutationFn: async (data: { targetNode: string; channelIndex?: number }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/metadata/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          channel_index: data.channelIndex ?? 0,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};

export const useGetConnectionStatus = () => {
  return useMutation({
    mutationFn: async (data: { targetNode: string; channelIndex?: number }) => {
      const response = await trackedAdminFetch(`${API_BASE}/api/admin/connection-status/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: data.targetNode,
          channel_index: data.channelIndex ?? 0,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as AdminResponse;
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};
