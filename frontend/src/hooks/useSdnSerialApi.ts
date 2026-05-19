import { useMutation } from "@tanstack/react-query";
import { trackedAdminFetch } from "@/hooks/adminActivity";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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

  return new Error(detail || fallback || `HTTP ${response.status}`);
}

export interface GenericSendResponse {
  status: string;
  details: Record<string, unknown>;
}

export interface RouteInstallSerialPayload {
  destination: string;
  path: string[];
  installId?: number;
  startNode: string;
  channelIndex?: number;
  wantAck?: boolean;
}

export const useRouteInstallSerial = () => {
  return useMutation({
    mutationFn: async (data: RouteInstallSerialPayload) => {
      const response = await trackedAdminFetch(`${API_BASE}/sdn/route-install/serial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: data.destination,
          path: data.path,
          install_id: data.installId ?? 1,
          start_node: data.startNode,
          channel_index: data.channelIndex ?? 0,
          want_ack: data.wantAck ?? false,
        }),
      });

      if (!response.ok) {
        throw await buildApiError(response, "Failed to send route install command");
      }

      return (await response.json()) as GenericSendResponse;
    },
    onSuccess: () => toast.success("Route install command sent"),
    onError: (error) => toast.error(`Error: ${error.message}`),
  });
};
