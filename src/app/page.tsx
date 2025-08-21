
"use client";

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, off, set } from "firebase/database";
import { database } from '@/lib/firebase';
import { Thermometer, Droplets, Waves, Lightbulb, CloudRain, Wifi, WifiOff } from 'lucide-react';

import { Header } from '@/components/dashboard/header';
import { SensorCard } from '@/components/dashboard/sensor-card';
import { DeviceControlCard } from '@/components/dashboard/device-control-card';
import { CropManagement } from '@/components/dashboard/crop-management';
import { AutomatedClimateControl } from '@/components/dashboard/automated-climate-control';
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
}

interface ControlsData {
  remoteControlEnabled: boolean;
  remotePumpControl: boolean;
  remoteBulbControl: boolean;
}

const useFirebaseData = () => {
  const [sensors, setSensors] = useState<SensorData>({ temperature: 0, humidity: 0, soilMoisture: 0, soilMoisturePercent: 0 });
  const [actuators, setActuators] = useState<ActuatorData>({ pumpStatus: false, bulbStatus: false });
  const [system, setSystem] = useState<SystemData>({ deviceOnline: false });
  const [controls, setControls] = useState<ControlsData>({ remoteControlEnabled: false, remotePumpControl: false, remoteBulbControl: false });
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const initialDataReceived = useRef(false);

  const handleInitialLoad = () => {
    if (!initialDataReceived.current) {
        initialDataReceived.current = true;
        setIsLoading(false);
    }
  };

  useEffect(() => {
    const sensorsRef = ref(database, 'sensors');
    const actuatorsRef = ref(database, 'actuators');
    const systemRef = ref(database, 'system');
    const controlsRef = ref(database, 'controls');
    const connectedRef = ref(database, '.info/connected');

    const onSensorsValue = onValue(sensorsRef, (snapshot) => {
      const value = snapshot.val();
      if (value) {
        setSensors(prev => ({
          ...prev,
          temperature: value.temperature || 0,
          humidity: value.humidity || 0,
        }));
        handleInitialLoad();
      }
    }, (err) => {
      console.error("Firebase sensor read error:", err);
      setError("Failed to read sensor data.");
    });

    const onActuatorsValue = onValue(actuatorsRef, (snapshot) => {
      const value = snapshot.val();
      if (value) {
        setActuators({
          pumpStatus: !!value.pumpStatus,
          bulbStatus: !!value.bulbStatus,
        });
      }
    }, (err) => {
      console.error("Firebase actuator read error:", err);
      setError("Failed to read actuator data.");
    });

    const onSystemValue = onValue(systemRef, (snapshot) => {
      const value = snapshot.val();
      if (value) {
        setSystem({
          deviceOnline: !!value.deviceOnline,
        });
      }
    }, (err) => {
      console.error("Firebase system read error:", err);
      setError("Failed to read system data.");
    });

    const onControlsValue = onValue(controlsRef, (snapshot) => {
      const value = snapshot.val();
      if (value) {
        setControls({
          remoteControlEnabled: !!value.remoteControlEnabled,
          remotePumpControl: !!value.remotePumpControl,
          remoteBulbControl: !!value.remoteBulbControl,
        });
      }
    }, (err) => {
      console.error("Firebase controls read error:", err);
      setError("Failed to read control settings.");
    });

    const onConnectedValue = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val() === true;
      setIsConnected(connected);
      if (!connected) {
        setError("Connection to Firebase lost. Retrying...");
      } else if (error === "Connection to Firebase lost. Retrying...") {
        setError(null);
      }
    });

    return () => {
      off(sensorsRef, 'value', onSensorsValue);
      off(actuatorsRef, 'value', onActuatorsValue);
      off(systemRef, 'value', onSystemValue);
      off(controlsRef, 'value', onControlsValue);
      off(connectedRef, 'value', onConnectedValue);
    };
  }, [error]);
  
  // This effect will simulate the soil moisture data
  useEffect(() => {
    const moistureValues = [15, 23, 45, 55, 30];
    let currentIndex = 0;
    
    setSensors(prev => ({ ...prev, soilMoisturePercent: moistureValues[0] }));

    const intervalId = setInterval(() => {
      currentIndex = (currentIndex + 1) % moistureValues.length;
      const newMoistureValue = moistureValues[currentIndex];
      setSensors(prev => ({
        ...prev,
        soilMoisturePercent: newMoistureValue
      }));
    }, 60000); // Update every 1 minute

    return () => clearInterval(intervalId);
  }, []);

  const deviceOnline = system.deviceOnline && isConnected;
  
  return { sensors, actuators, controls, system, isConnected: deviceOnline, isLoading, error };
};

const StatusIndicator = ({ isConnected, isLoading, error }: { isConnected: boolean, isLoading: boolean, error: string | null }) => (
  <div className="flex items-center gap-4 mb-6 animate-in fade-in-0 duration-300">
    <Badge variant={isConnected ? 'default' : 'destructive'} className="flex items-center gap-2 bg-primary/10 border-primary/20 text-primary">
      {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      <span>{isConnected ? 'Online' : 'Offline'}</span>
    </Badge>
    <div className="text-sm text-muted-foreground">
      {isLoading ? (
        <Skeleton className="h-4 w-48" />
      ) : error ? (
        <span className="text-destructive">{error}</span>
      ) : isConnected ? (
        'Live data connection established.'
      ) : (
        'Device is offline. Waiting for connection...'
      )}
    </div>
  </div>
);


export default function DashboardPage() {
  const { sensors, actuators, controls, isConnected, isLoading, error } = useFirebaseData();
  const [insights, setInsights] = useState<string[]>([]);

  const handleNewInsight = (insight: string) => {
    setInsights(prev => [insight, ...prev].slice(0, 10)); // Keep last 10 insights
  };
  
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Header />
          <StatusIndicator isConnected={isConnected} isLoading={isLoading} error={error} />
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
              value={sensors.soilMoisturePercent}
              unit="%"
              isLoading={isLoading}
            />
             <div className="lg:col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                <DeviceControlCard
                    title="Grow Light"
                    icon={Lightbulb}
                    isChecked={actuators.bulbStatus}
                    isLoading={isLoading}
                    remoteControlEnabled={controls.remoteControlEnabled}
                    isRemoteControlled={controls.remoteBulbControl}
                />
                <DeviceControlCard
                    title="Water Pump"
                    icon={CloudRain}
                    isChecked={actuators.pumpStatus}
                    isLoading={isLoading}
                    remoteControlEnabled={controls.remoteControlEnabled}
                    isRemoteControlled={controls.remotePumpControl}
                />
            </div>
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-1 lg:grid-cols-3 animate-in fade-in-0 slide-in-from-bottom-6 duration-700 delay-200">
             <AutomatedClimateControl
              currentBulbStatus={actuators.bulbStatus}
              currentTemperature={sensors.temperature}
              currentHumidity={sensors.humidity}
              onNewInsight={handleNewInsight}
            />
            <CropManagement 
              onNewInsight={handleNewInsight}
              sensorData={{...sensors, soilMoisture: sensors.soilMoisturePercent}}
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
