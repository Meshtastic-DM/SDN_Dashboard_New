import { AlertTriangle, AlignCenter, RotateCcw } from 'lucide-react';

interface DeviceDisconnectionOverlayProps {
  message: string;
  port: string | null;
  onRetry?: () => void;
}

export function DeviceDisconnectionOverlay({ message, port, onRetry }: DeviceDisconnectionOverlayProps) {
  const handleReconnect = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
      <div className="rounded-lg border border-node-offline/40 bg-background shadow-2xl max-w-md p-8 space-y-6 pointer-events-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-node-offline flex-shrink-0" />
          <h2 className="font-mono text-lg font-bold text-node-offline" >DEVICE DISCONNECTED</h2>
        </div>

        {/* Message */}
        {/* <div className="space-y-3">
          <p className="font-mono text-sm text-muted-foreground">
            {message}
          </p>
          {port && (
            <div className="bg-card/50 border border-border rounded px-3 py-2">
              <p className="font-mono text-xs text-secondary">
                Last connected to: <span className="text-primary font-semibold">{port}</span>
              </p>
            </div>
          )}
        </div> */}

        {/* Instructions */}
        <div className="bg-card/50 border border-border/50 rounded px-4 py-3 space-y-2">
          <p className="font-mono text-xs font-semibold text-muted-foreground">TO RECONNECT:</p>
          <ol className="font-mono text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
            <li>Ensure your Meshtastic device is connected to the COM port</li>
            <li>Click "Reconnect" to return to the connection screen</li>
            <li>Select the COM port again to re-establish the connection</li>
          </ol>
        </div>

        {/* Button */}
        <button
          onClick={handleReconnect}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-node-offline/10 hover:bg-node-offline/20 border border-node-offline/50 hover:border-node-offline text-node-offline font-mono text-sm font-semibold rounded-md transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Reconnect Device
        </button>

        {/* Footer note */}
        <p className="font-mono text-[10px] text-muted-foreground text-center">
          All dashboard features are disabled until the device is reconnected.
        </p>
      </div>
    </div>
  );
}
