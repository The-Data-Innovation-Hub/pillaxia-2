import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Navigation, Phone, Star } from "lucide-react";

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as { [key: string]: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom icons
const preferredIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const regularIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Nigerian state coordinates (approximate centers)
const NIGERIAN_STATE_COORDS: Record<string, [number, number]> = {
  "Abia": [5.4527, 7.5248],
  "Adamawa": [9.3265, 12.3984],
  "Akwa Ibom": [5.0377, 7.9128],
  "Anambra": [6.2209, 7.0350],
  "Bauchi": [10.3105, 9.8442],
  "Bayelsa": [4.7719, 6.0699],
  "Benue": [7.3369, 8.7404],
  "Borno": [11.8333, 13.1500],
  "Cross River": [5.8702, 8.5988],
  "Delta": [5.7040, 5.9339],
  "Ebonyi": [6.2649, 8.0137],
  "Edo": [6.6342, 5.9304],
  "Ekiti": [7.7190, 5.3110],
  "Enugu": [6.5364, 7.4356],
  "FCT": [9.0579, 7.4951],
  "Gombe": [10.2897, 11.1673],
  "Imo": [5.4833, 7.0333],
  "Jigawa": [12.2280, 9.5616],
  "Kaduna": [10.5264, 7.4388],
  "Kano": [12.0022, 8.5919],
  "Katsina": [12.9908, 7.6018],
  "Kebbi": [12.4539, 4.1994],
  "Kogi": [7.7337, 6.6906],
  "Kwara": [8.9669, 4.3874],
  "Lagos": [6.5244, 3.3792],
  "Nasarawa": [8.5379, 8.3218],
  "Niger": [9.9309, 5.5983],
  "Ogun": [7.1601, 3.3500],
  "Ondo": [7.2500, 5.1931],
  "Osun": [7.5629, 4.5200],
  "Oyo": [7.8500, 3.9333],
  "Plateau": [9.2182, 9.5175],
  "Rivers": [4.8156, 7.0498],
  "Sokoto": [13.0622, 5.2339],
  "Taraba": [7.9994, 10.7740],
  "Yobe": [12.2939, 11.4390],
  "Zamfara": [12.1628, 6.2536],
};

const NIGERIAN_STATES = Object.keys(NIGERIAN_STATE_COORDS);

interface PharmacyLocation {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  state: string;
  phone: string | null;
  latitude?: number;
  longitude?: number;
}

interface PharmacyMapViewProps {
  pharmacies: PharmacyLocation[];
  preferredPharmacyIds?: string[];
  onSelectPharmacy?: (pharmacy: PharmacyLocation) => void;
}

// Component to recenter map when state filter changes
function MapRecenter({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(coords, 8);
  }, [coords, map]);
  return null;
}

export function PharmacyMapView({
  pharmacies,
  preferredPharmacyIds = [],
  onSelectPharmacy,
}: PharmacyMapViewProps) {
  const [stateFilter, setStateFilter] = useState<string>("Lagos");
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyLocation | null>(null);

  // Assign coordinates to pharmacies based on their state (with slight random offset for visualization)
  const pharmaciesWithCoords = useMemo(() => {
    return pharmacies.map((pharmacy, index) => {
      const stateCoords = NIGERIAN_STATE_COORDS[pharmacy.state] || [9.0820, 8.6753]; // Nigeria center fallback
      // Add slight offset to prevent markers from overlapping
      const offset = 0.01 * (index % 10);
      return {
        ...pharmacy,
        latitude: stateCoords[0] + offset * (index % 2 === 0 ? 1 : -1),
        longitude: stateCoords[1] + offset * (index % 3 === 0 ? 1 : -1),
      };
    });
  }, [pharmacies]);

  // Filter pharmacies by selected state
  const filteredPharmacies = useMemo(() => {
    if (!stateFilter) return pharmaciesWithCoords;
    return pharmaciesWithCoords.filter((p) => p.state === stateFilter);
  }, [pharmaciesWithCoords, stateFilter]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (stateFilter && NIGERIAN_STATE_COORDS[stateFilter]) {
      return NIGERIAN_STATE_COORDS[stateFilter];
    }
    return [9.0820, 8.6753]; // Nigeria center
  }, [stateFilter]);

  const handlePharmacyClick = (pharmacy: PharmacyLocation) => {
    setSelectedPharmacy(pharmacy);
    onSelectPharmacy?.(pharmacy);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Pharmacy Locations Map
          </CardTitle>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-[1000] max-h-60">
              {NIGERIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-accent" />
              <span>Preferred Pharmacy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary" />
              <span>Available Pharmacy</span>
            </div>
          </div>

          {/* Map */}
          <div className="h-[400px] rounded-lg overflow-hidden border">
            <MapContainer
              center={mapCenter}
              zoom={8}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapRecenter coords={mapCenter} />
              
              {filteredPharmacies.map((pharmacy) => {
                const isPreferred = preferredPharmacyIds.includes(pharmacy.id);
                return (
                  <Marker
                    key={pharmacy.id}
                    position={[pharmacy.latitude!, pharmacy.longitude!]}
                    icon={isPreferred ? preferredIcon : regularIcon}
                    eventHandlers={{
                      click: () => handlePharmacyClick(pharmacy),
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px] space-y-2">
                        <div className="flex items-center gap-2">
                          {isPreferred && <Star className="h-4 w-4 text-primary fill-primary" />}
                          <span className="font-semibold">{pharmacy.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pharmacy.address_line1}, {pharmacy.city}
                        </p>
                        {pharmacy.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            <span>{pharmacy.phone}</span>
                          </div>
                        )}
                        {isPreferred && (
                          <Badge variant="secondary" className="text-xs">
                            Your Preferred Pharmacy
                          </Badge>
                        )}
                        {onSelectPharmacy && !isPreferred && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2"
                            onClick={() => onSelectPharmacy(pharmacy)}
                          >
                            Add to Preferred
                          </Button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Pharmacy count */}
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredPharmacies.length} pharmacies in {stateFilter || "Nigeria"}
          </p>

          {/* Selected pharmacy details */}
          {selectedPharmacy && (
            <div className="p-4 rounded-lg border bg-muted/50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {preferredPharmacyIds.includes(selectedPharmacy.id) && (
                      <Star className="h-4 w-4 text-primary fill-primary" />
                    )}
                    <h4 className="font-semibold">{selectedPharmacy.name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedPharmacy.address_line1}, {selectedPharmacy.city}, {selectedPharmacy.state}
                  </p>
                  {selectedPharmacy.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />
                      {selectedPharmacy.phone}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${selectedPharmacy.name}, ${selectedPharmacy.city}, ${selectedPharmacy.state}, Nigeria`
                    )}`;
                    window.open(url, "_blank");
                  }}
                >
                  <Navigation className="h-4 w-4" />
                  Directions
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
