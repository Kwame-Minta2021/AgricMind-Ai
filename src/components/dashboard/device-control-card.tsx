
"use client";

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
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
      // Bulb control requires setting remote mode first, then sending a command.
      await set(ref(database, 'controls/remoteBulbControl'), true);
      await new Promise(resolve => setTimeout(resolve, 50)); // Give ESP32 time to switch mode
      await set(ref(database, 'controls/manualBulbCommand'), checked);
    } else {
      // Pump control is direct: just set the actuator status.
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
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 h-full flex flex-col bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center pb-2">
         <div className={cn("font-bold text-3xl text-center", isChecked ? 'text-primary' : 'text-muted-foreground')}>{isChecked ? 'ON' : 'OFF'}</div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pt-2">
        <Button
          onClick={() => handleCheckedChange(!isChecked)}
          disabled={isMasterDisabled}
          variant={isChecked ? 'destructive' : 'default'}
          size="sm"
          className="w-full rounded-full"
        >
          <Power className="mr-2 h-4 w-4" />
          {isChecked ? 'Turn OFF' : 'Turn ON'}
        </Button>
        <div className="text-xs text-muted-foreground h-4 text-center w-full">{getStatusDescription()}</div>
      </CardFooter>
    </Card>
  );
}
