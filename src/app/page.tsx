
"use client";

import { useState, useEffect } from 'react';
import { ref, onValue, off } from "firebase/database";
import { database } from '@/lib/firebase';
import { Thermometer, Droplets, Waves, Lightbulb, CloudRain, Wifi, WifiOff } from 'lucide-react';
import { format } from 'date-fns';

import { Header } from '@/components/dashboard/header';
import { SensorCard } from '@/components/dashboard/sensor-card';
import { DeviceControlCard } from '@/components/dashboard/device-control-card';
import { CropManagement } from '@/components/dashboard/crop-management';
import { AutomatedIrrigation } from '@/components/dashboard/automated-irrigation';
import { InsightsPanel } from '@/components/dashboard/insights-panel';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface SensorData {
  temperature: number;
  humidity: number;
  soilMoisture: number; // raw ADC
  soilMoisturePercent: number; // percentage
}

interface ActuatorData {
  pumpStatus: boolean;
  bulbStatus: boolean;
}

interface SystemData {
  deviceOnline: boolean;
  lastUpdate: string;
}

const useFirebaseData = () => {
  const [sensors, setSensors] = useState<SensorData>({ temperature: 0, humidity: 0, soilMoisture: 0, soilMoisturePercent: 0 });
  const [actuators, setActuators] = useState<ActuatorData>({ pumpStatus: false, bulbStatus: false });
  const [system, setSystem] = useState<SystemData>({ deviceOnline: false, lastUpdate: '' });
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sensorsRef = ref(database, 'sensors');
    const actuatorsRef = ref(database, 'actuators');
    const systemRef = ref(database, 'system');
    const connectedRef = ref(database, '.info/connected');

    const onData = (path: string) => (snapshot: any) => {
      try {
        const value = snapshot.val();
        if (value) {
          if (path === 'sensors') {
            setSensors({
              temperature: value.temperature || 0,
              humidity: value.humidity || 0,
              soilMoisture: value.soilMoisture || 0,
              soilMoisturePercent: value.soilMoisturePercent || 0,
            });
          } else if (path === 'actuators') {
            setActuators({
              pumpStatus: !!value.pumpStatus,
              bulbStatus: !!value.bulbStatus
            });
          } else if (path === 'system') {
            setSystem({
              deviceOnline: !!value.deviceOnline,
              lastUpdate: value.lastUpdate || ''
            });
          }
          setError(null);
        } else {
          setError(`No data received from Firebase path: ${path}. Check your device and database.`);
        }
      } catch (e: any) {
        console.error("Firebase data processing error:", e);
        setError(`Failed to process data from Firebase path: ${path}.`);
      } finally {
        setIsLoading(false);
      }
    };
    
    const onError = (path: string) => (err: any) => {
      console.error(`Firebase Read Error on ${path}:`, err);
      setError(`Failed to read data from Firebase path: ${path}.`);
      setIsLoading(false);
    };

    const onConnected = onValue(connectedRef, (snap) => {
      const connected = snap.val() === true;
      setIsConnected(connected);
      if (!connected) {
        setError("Connection to Firebase lost. Retrying...");
      } else if (error === "Connection to Firebase lost. Retrying...") {
        setError(null);
      }
    });

    const sensorListener = onValue(sensorsRef, onData('sensors'), onError('sensors'));
    const actuatorListener = onValue(actuatorsRef, onData('actuators'), onError('actuators'));
    const systemListener = onValue(systemRef, onData('system'), onError('system'));

    return () => {
      off(sensorsRef, 'value', sensorListener);
      off(actuatorsRef, 'value', actuatorListener);
      off(systemRef, 'value', systemListener);
      const connectedListenerUnsubscribe = onValue(connectedRef, () => {});
      connectedListenerUnsubscribe();
    };
  }, [error]);

  const soilMoisturePercent = sensors.soilMoisturePercent;
  const lastUpdated = system.lastUpdate;
  const deviceOnline = system.deviceOnline && isConnected;

  return { sensors: { ...sensors, soilMoisture: soilMoisturePercent }, actuators, lastUpdated, isConnected: deviceOnline, isLoading, error };
};

const StatusIndicator = ({ isConnected, isLoading, lastUpdated, error }: { isConnected: boolean, isLoading: boolean, lastUpdated: string | null, error: string | null }) => (
  <div className="flex items-center gap-4 mb-6 animate-in fade-in-0 duration-300">
    <Badge variant={isConnected ? 'default' : 'destructive'} className="flex items-center gap-2 bg-primary/10 border-primary/20 text-primary">
      {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      <span>{isConnected ? 'Online' : 'Offline'}</span>
    </Badge>
    <div className="text-sm text-muted-foreground">
      {isLoading ? <Skeleton className="h-4 w-48" /> : (
        error ? <span className="text-destructive">{error}</span> :
        lastUpdated ? `Last Updated: ${format(new Date(parseInt(lastUpdated)), "PPP p")}` : 'Waiting for data...'
      )}
    </div>
  </div>
);


export default function DashboardPage() {
  const { sensors, actuators, lastUpdated, isConnected, isLoading, error } = useFirebaseData();
  const [insights, setInsights] = useState<string[]>([]);

  const handleNewInsight = (insight: string) => {
    setInsights(prev => [insight, ...prev].slice(0, 10)); // Keep last 10 insights
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Header />
          <StatusIndicator isConnected={isConnected} isLoading={isLoading} lastUpdated={lastUpdated} error={error} />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <SensorCard
              title="Temperature"
              icon={Thermometer}
              value={sensors.temperature}
              unit="°C"
              isLoading={isLoading}
            />
            <SensorCard
              title="Humidity"
              icon={Droplets}
              value={sensors.humidity}
              unit="%"
              isLoading={isLoading}
            />
            <SensorCard
              title="Soil Moisture"
              icon={Waves}
              value={sensors.soilMoisture}
              unit="%"
              isLoading={isLoading}
            />
             <div className="lg:col-span-1 md:col-span-2 grid grid-cols-2 gap-6">
                <DeviceControlCard
                    title="Grow Light"
                    icon={Lightbulb}
                    isChecked={actuators.bulbStatus}
                    description="Simulated sunlight"
                    isLoading={isLoading}
                />
                <DeviceControlCard
                    title="Water Pump"
                    icon={CloudRain}
                    isChecked={actuators.pumpStatus}
                    description="Irrigation system"
                    isLoading={isLoading}
                />
            </div>
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-1 lg:grid-cols-2 animate-in fade-in-0 slide-in-from-bottom-6 duration-700 delay-200">
            <AutomatedIrrigation 
              currentPumpStatus={actuators.pumpStatus}
              currentSoilMoisture={sensors.soilMoisture}
              onNewInsight={handleNewInsight}
            />
            <CropManagement 
              onNewInsight={handleNewInsight}
              sensorData={sensors}
            />
          </div>
          <div className="mt-8 animate-in fade-in-0 slide-in-from-bottom-8 duration-900 delay-400">
            <InsightsPanel insights={insights} />
          </div>
        </div>
      </main>
    </div>
  );
}
