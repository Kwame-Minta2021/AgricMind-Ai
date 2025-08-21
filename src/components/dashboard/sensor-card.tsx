
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface SensorCardProps {
  title: string;
  icon: LucideIcon;
  value?: number;
  unit: string;
  isLoading?: boolean;
  precision?: number;
}

export function SensorCard({ title, icon: Icon, value, unit, isLoading, precision = 1 }: SensorCardProps) {
  const displayValue = value !== undefined ? value.toFixed(precision) : '0.0';
  
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <div className="text-2xl font-bold">
            {`${displayValue} ${unit}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
