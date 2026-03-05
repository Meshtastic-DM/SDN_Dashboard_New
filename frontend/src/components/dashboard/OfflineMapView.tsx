import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/components/OfflineMapView.css';
import { useNodesContext } from '@/contexts/NodesContext';
import { NodeDisplayData } from '@/types/nodes';
import { Loader2 } from 'lucide-react';

// Fix for default marker icon in React-Leaflet
type IconDefault = L.Icon.Default & {
  _getIconUrl?: () => string;
};

delete (L.Icon.Default.prototype as IconDefault)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Custom marker icons for Meshtastic nodes
const createCustomIcon = (node: NodeDisplayData) => {
  const statusMap = {
    online: '#10B981',
    offline: '#EF4444',
    warning: '#F59E0B',
  };

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-container">
        <div class="marker-circle" style="background-color: #00D9FF; border-color: ${statusMap[node.status]}"></div>
        <div class="marker-label">${node.name}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
};

// LocationMarker component to track user location
function LocationMarker() {
  const [position, setPosition] = React.useState<L.LatLng | null>(null);
  const map = useMapEvents({
    click() {
      map.locate();
    },
    locationfound(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>You are here</Popup>
    </Marker>
  );
}

interface OfflineMapViewProps {
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
}

const OfflineMapView: React.FC<OfflineMapViewProps> = ({ selectedNodeId, onSelectNode }) => {
  const { nodes, loading, error } = useNodesContext();
  
  // Filter nodes that have valid GPS coordinates
  const nodesWithCoords = useMemo(() => {
    return nodes.filter(node => 
      node.latitude !== undefined && 
      node.longitude !== undefined &&
      !isNaN(node.latitude) &&
      !isNaN(node.longitude)
    );
  }, [nodes]);

  // Calculate map center based on average position of all nodes with GPS
  const mapCenter: [number, number] = useMemo(() => {
    const avgLat = nodesWithCoords.reduce((sum, node) => sum + (node.latitude || 0), 0) / nodesWithCoords.length;
    const avgLon = nodesWithCoords.reduce((sum, node) => sum + (node.longitude || 0), 0) / nodesWithCoords.length;
    return [avgLat, avgLon];
  }, [nodesWithCoords]);

  const defaultZoom = 13;

  if (loading && nodes.length === 0) {
    return (
      <div className="offline-map-container">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="offline-map-container">
        <div className="flex items-center justify-center h-full text-red-500 font-mono text-sm">
          Error loading nodes: {error}
        </div>
      </div>
    );
  }

  if (nodesWithCoords.length === 0) {
    return (
      <div className="offline-map-container">
        <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm">
          No nodes with GPS coordinates found
        </div>
      </div>
    );
  }

  return (
    <div className="offline-map-container">
      <MapContainer
        center={mapCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <LocationMarker />
        
        {nodesWithCoords.map((node) => (
          <Marker
            key={node.id}
            position={[node.latitude!, node.longitude!]}
            icon={createCustomIcon(node)}
            eventHandlers={{
              click: () => {
                if (onSelectNode) {
                  onSelectNode(node.id);
                }
              },
            }}
          >
            <Popup>
              <div className="node-popup">
                <h4 className="font-semibold text-lg mb-2">{node.name}</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>ID:</strong> {node.id}</p>
                  <p><strong>HW Model:</strong> {node.hwModel}</p>
                  <p><strong>Role:</strong> {node.role || 'N/A'}</p>
                  <p><strong>Status:</strong> <span className={`status-${node.status}`}>{node.status}</span></p>
                  <p><strong>SNR:</strong> {node.snr}</p>
                  <p><strong>Battery:</strong> {node.batteryLevel}</p>
                  <p><strong>Hops Away:</strong> {node.hopsAway}</p>
                  <p><strong>Location:</strong> {node.latitude!.toFixed(6)}, {node.longitude!.toFixed(6)}</p>
                  <p><strong>Altitude:</strong> {node.altitude}m</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default OfflineMapView;
