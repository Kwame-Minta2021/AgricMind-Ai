
"use client";

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { database } from '@/lib/firebase';
import { ref, set } from "firebase/database";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

  const handleRemoteToggle = async () => {
    const isBulb = title === 'Grow Light';
    const remoteControlPath = isBulb ? 'controls/remoteBulbControl' : 'controls/remotePumpControl';
    
    // Always set to true to enable remote mode
    await set(ref(database, remoteControlPath), true);
  };
  
  const handleCheckedChange = async (checked: boolean) => {
    if (!isRemoteControlled) return; // Should be disabled, but as a safeguard
    
    const isBulb = title === 'Grow Light';
    const commandPath = isBulb ? 'controls/manualBulbCommand' : 'controls/manualPumpCommand';

    // Send the on/off command
    await set(ref(database, commandPath), checked);
  };
  
  const isMasterDisabled = isLoading || !remoteControlEnabled;
  const isSwitchDisabled = isMasterDisabled || !isRemoteControlled;

  const getStatusDescription = () => {
    if (isMasterDisabled) return "Remote master disabled";
    if (isRemoteControlled) {
      const mode = title === 'Grow Light' ? 'Remote' : 'Remote';
      return <span className="text-green-600 font-semibold">{mode} Mode Active</span>;
    }
    const mode = title === 'Grow Light' ? 'Manual' : 'Auto';
    return `${mode} Mode`;
  };
  
  const getDisabledMessage = () => {
    if (isLoading) return "Loading...";
    if (!remoteControlEnabled) return "Enable remote master";
    if (!isRemoteControlled) return "Set to Remote to enable";
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

          {!isRemoteControlled && (
             <Button 
                variant="outline"
                size="sm"
                onClick={handleRemoteToggle}
                disabled={isMasterDisabled}
                className="flex items-center gap-2"
              >
                <Power className="h-4 w-4" /> Set to Remote
            </Button>
          )}

          {isRemoteControlled && (
            <div className="flex flex-col items-end space-y-1">
              <Switch
                id={switchId}
                checked={isChecked}
                onCheckedChange={handleCheckedChange}
                disabled={isSwitchDisabled}
                aria-label={`Toggle ${title}`}
              />
              <Label htmlFor={switchId} className={cn("text-xs", isSwitchDisabled ? "text-muted-foreground/50" : "text-muted-foreground")}>
                {getDisabledMessage()}
              </Label>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
