
"use client";

import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { database } from '@/lib/firebase';
import { ref, set } from "firebase/database";
import { cn } from '@/lib/utils';

interface DeviceControlCardProps {
  title: string;
  icon: LucideIcon;
  isChecked: boolean;
  isDisabled: boolean;
  description: string;
  isLoading?: boolean;
  remoteControlEnabled: boolean;
  isRemoteControlled: boolean;
}

export function DeviceControlCard({ title, icon: Icon, isChecked, isDisabled, description, isLoading, remoteControlEnabled, isRemoteControlled }: DeviceControlCardProps) {
  const switchId = `switch-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const [localChecked, setLocalChecked] = useState(isChecked);

  useEffect(() => {
    setLocalChecked(isChecked);
  }, [isChecked]);

  const handleCheckedChange = async (checked: boolean) => {
    if (isDisabled) return;
    setLocalChecked(checked); // Optimistic UI update

    const isBulb = title === 'Grow Light';
    const remoteControlPath = isBulb ? 'controls/remoteBulbControl' : 'controls/remotePumpControl';
    const commandPath = isBulb ? 'controls/manualBulbCommand' : 'controls/manualPumpCommand';

    // If not in remote mode, switch to it first.
    if (!isRemoteControlled) {
      await set(ref(database, remoteControlPath), true);
    }
    
    // Send the on/off command
    await set(ref(database, commandPath), checked);
  };
  
  const getDisabledMessage = () => {
    if (isLoading) return "Loading...";
    if (!remoteControlEnabled) return "Enable remote master";
    // The control is no longer disabled just because it's not in remote mode,
    // since we now handle that automatically.
    return description;
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 h-full bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor={switchId} className={cn("flex flex-col space-y-1", isDisabled && "cursor-not-allowed opacity-50")}>
            <span className="font-medium">{localChecked ? 'ON' : 'OFF'}</span>
            <span className="text-xs text-muted-foreground">{getDisabledMessage()}</span>
          </Label>
          <Switch
            id={switchId}
            checked={localChecked}
            onCheckedChange={handleCheckedChange}
            disabled={isDisabled || isLoading}
            aria-label={`Toggle ${title}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
