
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Thermometer, Sun } from 'lucide-react';
import { automateClimate } from '@/ai/flows/automated-climate-control';
import { useToast } from "@/hooks/use-toast";
import { database } from '@/lib/firebase';
import { ref, set } from "firebase/database";

interface AutomatedClimateControlProps {
  currentBulbStatus: boolean;
  onNewInsight: (insight: string) => void;
  currentTemperature: number;
  currentHumidity: number;
}

export function AutomatedClimateControl({ currentBulbStatus, onNewInsight, currentTemperature, currentHumidity }: AutomatedClimateControlProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const handleAutomation = async () => {
    setIsLoading(true);
    try {
      const result = await automateClimate({
        temperature: currentTemperature,
        humidity: currentHumidity,
        bulbStatus: currentBulbStatus,
      });
      
      onNewInsight(`AI Climate Control: ${result.reason}`);
      
      // The AI now writes to the manual command path to control the bulb
      if (result.newBulbStatus !== currentBulbStatus) {
        await set(ref(database, 'controls/manualBulbCommand'), result.newBulbStatus);
      }
      
    } catch (error) {
      console.error("AI Error:", error);
       toast({
        variant: "destructive",
        title: "AI Error",
        description: "Could not run climate automation.",
      });
      onNewInsight("Error: Could not run climate automation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
            <Sun className="w-6 h-6 text-primary" />
            <CardTitle>Automated Climate</CardTitle>
        </div>
        <CardDescription>Let AI manage the grow light based on climate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
         <div className='text-sm space-y-2'>
            <p><strong>Rule:</strong> Light turns OFF if Temp ≥ 33°C and Humidity ≥ 85%.</p>
            <p><strong>Current:</strong> Temp: {currentTemperature.toFixed(1)}°C, Humidity: {currentHumidity.toFixed(1)}%</p>
         </div>
        
        <Button onClick={handleAutomation} disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Thermometer className="mr-2 h-4 w-4" />}
          Run AI Control
        </Button>
      </CardContent>
    </Card>
  );
}
