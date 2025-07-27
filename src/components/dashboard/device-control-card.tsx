
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getDatabase, ref, set } from "firebase/database";

interface DeviceControlCardProps {
  title: string;
  icon: LucideIcon;
  isChecked: boolean;
  description: string;
  isLoading?: boolean;
}

export function DeviceControlCard({ title, icon: Icon, isChecked, description, isLoading }: DeviceControlCardProps) {
  const switchId = `switch-${title.toLowerCase().replace(/\s+/g, '-')}`;

  const handleCheckedChange = (checked: boolean) => {
    const db = getDatabase();
    const actuatorPath = title === 'Grow Light' ? 'actuators/bulbStatus' : 'actuators/pumpStatus';
    set(ref(db, actuatorPath), checked);
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 h-full bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor={switchId} className="flex flex-col space-y-1">
            <span className="font-medium">{isChecked ? 'ON' : 'OFF'}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </Label>
          <Switch
            id={switchId}
            checked={isChecked}
            onCheckedChange={handleCheckedChange}
            disabled={isLoading}
            aria-label={`Toggle ${title}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
