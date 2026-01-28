import { useState } from "react";
import { useTrustedDevices } from "@/hooks/useTrustedDevices";
import { formatDistanceToNow, format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Trash2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const getDeviceIcon = (os: string | null) => {
  if (!os) return Monitor;
  const lower = os.toLowerCase();
  if (lower.includes("ios") || lower.includes("android")) {
    return lower.includes("tablet") ? Tablet : Smartphone;
  }
  if (lower.includes("mac") || lower.includes("windows") || lower.includes("linux")) {
    return Laptop;
  }
  return Monitor;
};

export function TrustedDevicesCard() {
  const { devices, loading, revokeDevice, revokeAllDevices, fetchDevices, isDeviceTrusted } = useTrustedDevices();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const handleRevoke = async (deviceId: string) => {
    setRevoking(deviceId);
    const success = await revokeDevice(deviceId);
    if (success) {
      toast.success("Device trust revoked");
    } else {
      toast.error("Failed to revoke device");
    }
    setRevoking(null);
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    const count = await revokeAllDevices();
    if (count > 0) {
      toast.success(`Revoked trust for ${count} device${count === 1 ? "" : "s"}`);
    } else {
      toast.info("No trusted devices to revoke");
    }
    setRevokingAll(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Trusted Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Trusted Devices
            </CardTitle>
            <CardDescription>
              Devices that can skip two-factor authentication for 30 days
            </CardDescription>
          </div>
          {devices.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  Revoke All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Revoke All Trusted Devices?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will require two-factor authentication on all devices, including this one,
                    for your next login. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRevokeAll}
                    disabled={revokingAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {revokingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Revoke All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No trusted devices</p>
            <p className="text-sm">
              Trust a device during login to skip 2FA for 30 days
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const DeviceIcon = getDeviceIcon(device.operating_system);
              const isCurrentDevice = isDeviceTrusted && device.last_used_at === devices[0]?.last_used_at;
              
              return (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <DeviceIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {device.device_name || "Unknown Device"}
                        </span>
                        {isCurrentDevice && (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                            This device
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Trusted {formatDistanceToNow(new Date(device.trusted_at), { addSuffix: true })}
                        </span>
                        <span>
                          Expires {format(new Date(device.expires_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevoke(device.id)}
                    disabled={revoking === device.id}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {revoking === device.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
