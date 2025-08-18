
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Droplets } from 'lucide-react';
import { automateIrrigation } from '@/ai/flows/automated-irrigation-control';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { database } from '@/lib/firebase';
import { ref, set } from "firebase/database";

interface AutomatedIrrigationProps {
  currentPumpStatus: boolean;
  onNewInsight: (insight: string) => void;
  currentSoilMoisture: number;
}

const OPTIMAL_MOISTURE = 60;

export function AutomatedIrrigation({ currentPumpStatus, onNewInsight, currentSoilMoisture }: AutomatedIrrigationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const handleAutomation = async () => {
    setIsLoading(true);
    try {
      const result = await automateIrrigation({
        soilMoisture: currentSoilMoisture,
        optimalMoisture: OPTIMAL_MOISTURE,
        pumpStatus: currentPumpStatus,
      });

      if (result.newPumpStatus !== currentPumpStatus) {
        // AI control should directly set the actuator status
        await set(ref(database, 'actuators/pumpStatus'), result.newPumpStatus);
      }
      onNewInsight(`AI Irrigation: ${result.reason}`);
    } catch (error) {
      console.error("AI Error:", error);
       toast({
        variant: "destructive",
        title: "AI Error",
        description: "Could not run irrigation automation.",
      });
      onNewInsight("Error: Could not run irrigation automation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
            <Droplets className="w-6 h-6 text-primary" />
            <CardTitle>Automated Irrigation</CardTitle>
        </div>
        <CardDescription>Let AI control the water pump based on soil moisture.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="soil-moisture" className='flex justify-between mb-2'>
            <span>Live Soil Moisture</span>
            <span className='font-bold text-primary'>{currentSoilMoisture.toFixed(1)}%</span>
          </Label>
          <Slider
            id="soil-moisture"
            min={0}
            max={100}
            step={1}
            value={[currentSoilMoisture]}
            disabled={true}
          />
          <div className='text-xs text-muted-foreground mt-1 text-right'>Optimal Level: {OPTIMAL_MOISTURE}%</div>
        </div>
        
        <Button onClick={handleAutomation} disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Droplets className="mr-2 h-4 w-4" />}
          Run AI Control
        </Button>
      </CardContent>
    </Card>
  );
}
