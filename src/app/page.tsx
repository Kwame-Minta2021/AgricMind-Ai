"use client";

import { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from "firebase/database";
import { database } from '@/lib/firebase';
import { Thermometer, Droplets, Waves, Lightbulb, CloudRain } from 'lucide-react';

import { Header } from '@/components/dashboard/header';
import { SensorCard } from '@/components/dashboard/sensor-card';
import { DeviceControlCard } from '@/components/dashboard/device-control-card';
import { CropManagement } from '@/components/dashboard/crop-management';
import { AutomatedIrrigation } from '@/components/dashboard/automated-irrigation';
import { InsightsPanel } from '@/components/dashboard/insights-panel';

const useSensorData = () => {
  const [data, setData] = useState({
    temperature: 0,
    humidity: 0,
    soilMoisture: 0,
  });

  useEffect(() => {
    const sensorDataRef = ref(database, 'sensorData');
    const unsubscribe = onValue(sensorDataRef, (snapshot) => {
      const value = snapshot.val();
      if (value) {
        setData(value);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return data;
};

export default function DashboardPage() {
  const sensorData = useSensorData();
  const [bulbOn, setBulbOn] = useState(true);
  const [pumpOn, setPumpOn] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hasData = sensorData.temperature !== 0 || sensorData.humidity !== 0 || sensorData.soilMoisture !== 0;
    if (hasData) {
      setIsLoading(false);
    }
  }, [sensorData]);

  const handleNewInsight = (insight: string) => {
    setInsights(prev => [insight, ...prev].slice(0, 10)); // Keep last 10 insights
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Header />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <SensorCard
              title="Temperature"
              icon={Thermometer}
              value={sensorData.temperature}
              unit="°C"
              isLoading={isLoading}
            />
            <SensorCard
              title="Humidity"
              icon={Droplets}
              value={sensorData.humidity}
              unit="%"
              isLoading={isLoading}
            />
            <SensorCard
              title="Soil Moisture"
              icon={Waves}
              value={sensorData.soilMoisture}
              unit="%"
              isLoading={isLoading}
            />
             <div className="lg:col-span-1 md:col-span-2 grid grid-cols-2 gap-6">
                <DeviceControlCard
                    title="Grow Light"
                    icon={Lightbulb}
                    isChecked={bulbOn}
                    onCheckedChange={setBulbOn}
                    description="Simulated sunlight"
                    isLoading={isLoading}
                />
                <DeviceControlCard
                    title="Water Pump"
                    icon={CloudRain}
                    isChecked={pumpOn}
                    onCheckedChange={setPumpOn}
                    description="Irrigation system"
                    isLoading={isLoading}
                />
            </div>
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-1 lg:grid-cols-2 animate-in fade-in-0 slide-in-from-bottom-6 duration-700 delay-200">
            <AutomatedIrrigation 
              currentPumpStatus={pumpOn}
              onPumpStatusChange={setPumpOn}
              onNewInsight={handleNewInsight}
              currentSoilMoisture={sensorData.soilMoisture}
            />
            <CropManagement onNewInsight={handleNewInsight} />
          </div>
          <div className="mt-8 animate-in fade-in-0 slide-in-from-bottom-8 duration-900 delay-400">
            <InsightsPanel insights={insights} />
          </div>
        </div>
      </main>
    </div>
  );
}
