
"use client";

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  const handleCheckedChange = async (checked: boolean) => {
    const isBulb = title === 'Grow Light';

    if (isBulb) {
      // For the bulb, we need to enable remote mode and send a command
      await set(ref(database, 'controls/remoteBulbControl'), true);
      await new Promise(resolve => setTimeout(resolve, 50));
      await set(ref(database, 'controls/manualBulbCommand'), checked);
    } else {
      // For the pump, the AI and manual logic directly sets the actuator status
      // We will also ensure it's in remote mode to override auto-logic
       await set(ref(database, 'controls/remotePumpControl'), true);
       await new Promise(resolve => setTimeout(resolve, 50));
       await set(ref(database, 'actuators/pumpStatus'), checked);
    }
  };
  
  const isMasterDisabled = isLoading || !remoteControlEnabled;

  const getStatusDescription = () => {
    if (isMasterDisabled) return "Remote master disabled";
    if (isRemoteControlled) {
      return <span className="text-primary font-semibold">Remote Mode</span>;
    }
    return title === 'Grow Light' ? "Manual Mode" : "Auto Mode";
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
            <Button
              onClick={() => handleCheckedChange(!isChecked)}
              disabled={isMasterDisabled}
              variant={isChecked ? 'destructive' : 'default'}
              size="sm"
              className="w-24"
            >
              <Power className="mr-2 h-4 w-4" />
              {isChecked ? 'Turn OFF' : 'Turn ON'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
