"use client";

import { useState, useEffect } from 'react';
import { Thermometer, Droplets, Waves, Lightbulb, CloudRain } from 'lucide-react';

import { Header } from '@/components/dashboard/header';
import { SensorCard } from '@/components/dashboard/sensor-card';
import { DeviceControlCard } from '@/components/dashboard/device-control-card';
import { CropManagement } from '@/components/dashboard/crop-management';
import { AutomatedIrrigation } from '@/components/dashboard/automated-irrigation';
import { InsightsPanel } from '@/components/dashboard/insights-panel';

// Mock data simulating IoT device updates
const useMockSensorData = () => {
  const [data, setData] = useState({
    temperature: 24.5,
    humidity: 60.2,
    soilMoisture: 45.8,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prevData => {
        const newTemp = Math.max(15, Math.min(35, prevData.temperature + (Math.random() - 0.5) * 0.5));
        const newHum = Math.max(30, Math.min(90, prevData.humidity + (Math.random() - 0.5) * 2));
        const newMoisture = Math.max(10, Math.min(80, prevData.soilMoisture + (Math.random() - 0.5) * 1));
        return {
          temperature: newTemp,
          humidity: newHum,
          soilMoisture: newMoisture,
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return data;
};

export default function DashboardPage() {
  const sensorData = useMockSensorData();
  const [bulbOn, setBulbOn] = useState(true);
  const [pumpOn, setPumpOn] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleNewInsight = (insight: string) => {
    setInsights(prev => [insight, ...prev]);
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Header />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
          <div className="mt-6 grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <AutomatedIrrigation 
              currentPumpStatus={pumpOn}
              onPumpStatusChange={setPumpOn}
              onNewInsight={handleNewInsight}
            />
            <CropManagement onNewInsight={handleNewInsight} />
          </div>
          <div className="mt-6">
            <InsightsPanel insights={insights} />
          </div>
        </div>
      </main>
    </div>
  );
}
