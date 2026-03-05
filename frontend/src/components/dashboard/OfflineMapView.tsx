import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/components/OfflineMapView.css';
import { mockNodes, type SDNNode } from '@/data/mockNodes';

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

// Custom marker icons for different node types
const createCustomIcon = (node: SDNNode) => {
  const colorMap = {
    switch: '#00D9FF',
    router: '#9333EA',
    controller: '#F59E0B',
    host: '#10B981',
  };

  const statusMap = {
    online: '#10B981',
    offline: '#EF4444',
    warning: '#F59E0B',
  };

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-container">
        <div class="marker-circle" style="background-color: ${colorMap[node.type]}; border-color: ${statusMap[node.status]}"></div>
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
  const defaultCenter: [number, number] = [6.9271, 79.8612]; // Colombo, Sri Lanka as default
  const defaultZoom = 13;

  // Convert nodes to have lat/lon coordinates based on their x/y positions
  const nodesWithCoords = useMemo(() => {
    const baseLatitude = 6.9271;
    const baseLongitude = 79.8612;
    const spread = 0.01; // degrees

    return mockNodes.map((node, index) => {
      // Use a circular distribution pattern based on node index
      const angle = (2 * Math.PI * index) / mockNodes.length;
      const radius = spread * (1 + Math.random() * 0.5); // Add some randomness
      
      return {
        ...node,
        lat: baseLatitude + radius * Math.cos(angle),
        lon: baseLongitude + radius * Math.sin(angle),
      };
    });
  }, []);

  if (nodesWithCoords.length === 0) {
    return (
      <div className="offline-map-container">
        <div className="view-placeholder">Loading map data...</div>
      </div>
    );
  }

  return (
    <div className="offline-map-container">
      <MapContainer
        center={defaultCenter}
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
            position={[node.lat, node.lon]}
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
                  <p><strong>Type:</strong> {node.type}</p>
                  <p><strong>IP:</strong> {node.ip}</p>
                  <p><strong>MAC:</strong> {node.mac}</p>
                  <p><strong>Status:</strong> <span className={`status-${node.status}`}>{node.status}</span></p>
                  <p><strong>Location:</strong> {node.lat.toFixed(4)}, {node.lon.toFixed(4)}</p>
                  <p><strong>Throughput:</strong> {node.throughput}</p>
                  <p><strong>Latency:</strong> {node.latency}</p>
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
