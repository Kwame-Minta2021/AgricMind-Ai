
"use client";

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { database } from '@/lib/firebase';
import { ref, set } from "firebase/database";
import { cn } from '@/lib/utils';
import { Power } from 'lucide-react';

interface DeviceControlCardProps {
  title: string;
  icon: LucideIcon;
  isChecked: boolean; // Actual status from /actuators
  isLoading?: boolean;
  remoteControlEnabled: boolean; // Master remote control
  isRemoteControlled: boolean; // Device-specific remote from /controls
}

export function DeviceControlCard({ title, icon: Icon, isChecked, isLoading, remoteControlEnabled, isRemoteControlled }: DeviceControlCardProps) {
  const switchId = `switch-${title.toLowerCase().replace(/\s+/g, '-')}`;

  const handleCheckedChange = async (checked: boolean) => {
    const isBulb = title === 'Grow Light';
    const remoteControlPath = isBulb ? 'controls/remoteBulbControl' : 'controls/remotePumpControl';
    const commandPath = isBulb ? 'controls/manualBulbCommand' : 'controls/manualBulbCommand';

    // First, ensure the device is in remote mode.
    await set(ref(database, remoteControlPath), true);
    
    // Add a small delay to allow the ESP32 to process the mode change
    await new Promise(resolve => setTimeout(resolve, 50));

    // Then, send the on/off command.
    await set(ref(database, commandPath), checked);
  };
  
  const isMasterDisabled = isLoading || !remoteControlEnabled;

  const getStatusDescription = () => {
    if (isMasterDisabled) return "Remote master disabled";
    const mode = title === 'Grow Light' ? 'Manual' : 'Auto';
    if (isRemoteControlled) {
      return <span className="text-primary font-semibold">Remote Mode</span>;
    }
    return `${mode} Mode`;
  };
  
  const getDisabledMessage = () => {
    if (isLoading) return "Loading...";
    if (!remoteControlEnabled) return "Enable master remote";
    return isChecked ? 'Device is ON' : 'Device is OFF';
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 h-full bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between space-x-2">
           <div className="flex flex-col space-y-1">
            <span className={cn("font-medium text-lg", isChecked ? 'text-primary' : 'text-muted-foreground')}>{isChecked ? 'ON' : 'OFF'}</span>
            <span className="text-xs text-muted-foreground">{getStatusDescription()}</span>
          </div>

          <div className="flex flex-col items-end space-y-1">
            <Switch
              id={switchId}
              checked={isChecked}
              onCheckedChange={handleCheckedChange}
              disabled={isMasterDisabled}
              aria-label={`Toggle ${title}`}
            />
            <Label htmlFor={switchId} className={cn("text-xs", isMasterDisabled ? "text-muted-foreground/50" : "text-muted-foreground")}>
              {getDisabledMessage()}
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
