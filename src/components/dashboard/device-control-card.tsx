
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
  isRemoteControlled: boolean;
  description: string;
  isLoading?: boolean;
}

export function DeviceControlCard({ title, icon: Icon, isChecked, isRemoteControlled, description, isLoading }: DeviceControlCardProps) {
  const switchId = `switch-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const [localChecked, setLocalChecked] = useState(isChecked);

  useEffect(() => {
    setLocalChecked(isChecked);
  }, [isChecked]);

  const handleCheckedChange = (checked: boolean) => {
    setLocalChecked(checked); // Optimistic UI update
    const commandPath = title === 'Grow Light' ? 'controls/manualBulbCommand' : 'controls/manualPumpCommand';
    set(ref(database, commandPath), checked);
  };
  
  const isDisabled = isLoading || !isRemoteControlled;

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
            <span className="text-xs text-muted-foreground">{!isRemoteControlled ? "Set to remote" : description}</span>
          </Label>
          <Switch
            id={switchId}
            checked={localChecked}
            onCheckedChange={handleCheckedChange}
            disabled={isDisabled}
            aria-label={`Toggle ${title}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
