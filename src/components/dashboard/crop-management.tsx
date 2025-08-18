"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Loader2, Sparkles, Droplet, Sprout, CheckCircle, ArrowRight, CornerDownRight } from 'lucide-react';
import { getCropBestPractices, CropBestPracticesOutput } from '@/ai/flows/best-practices';
import { cropRecommendation, CropRecommendationOutput } from '@/ai/flows/crop-recommendation';
import { getEnvironmentalImpact } from '@/ai/flows/environmental-impact';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const crops = ["Onion", "Carrot", "Potato", "Tomato", "Lettuce", "Wheat", "Corn", "Soybean"];

interface CropManagementProps {
  onNewInsight: (insight: string) => void;
  sensorData: {
    temperature: number;
    humidity: number;
    soilMoisture: number;
  };
}

export function CropManagement({ onNewInsight, sensorData }: CropManagementProps) {
  const [selectedCrop, setSelectedCrop] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [bestPractices, setBestPractices] = useState<CropBestPracticesOutput | null>(null);
  const [recommendation, setRecommendation] = useState<CropRecommendationOutput | null>(null);
  const { toast } = useToast();

  const handleGetRecommendations = async () => {
    if (!selectedCrop) return;

    setIsLoading(true);
    setBestPractices(null);
    setRecommendation(null);

    try {
      onNewInsight(`Fetching AI advice for ${selectedCrop}...`);
      
      const [practicesResult, recommendationResult, impactResult] = await Promise.all([
        getCropBestPractices({ crop: selectedCrop }),
        cropRecommendation({ currentCrop: selectedCrop }),
        getEnvironmentalImpact({ ...sensorData, crop: selectedCrop })
      ]);
      
      setBestPractices(practicesResult);
      onNewInsight(`Best practices for ${selectedCrop} loaded.`);
      
      setRecommendation(recommendationResult);
      onNewInsight(`4-season crop rotation plan for ${selectedCrop} is ready.`);
      
      onNewInsight(`Environmental Analysis: ${impactResult.impactAnalysis}`);

    } catch (error) {
      console.error("AI Error:", error);
      toast({
        variant: "destructive",
        title: "AI Error",
        description: "Could not get AI recommendations. Please try again.",
      });
      onNewInsight(`Error: Failed to get AI recommendations for ${selectedCrop}.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 bg-card/80 backdrop-blur-sm lg:col-span-1">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-primary" />
          <CardTitle>Crop Management AI</CardTitle>
        </div>
        <CardDescription>Select your crop for AI-powered advice.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select onValueChange={setSelectedCrop} value={selectedCrop}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a crop" />
          </SelectTrigger>
          <SelectContent>
            {crops.map(crop => (
              <SelectItem key={crop} value={crop}>{crop}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleGetRecommendations} disabled={!selectedCrop || isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Get AI Advice
        </Button>

        {recommendation && (
            <Alert className="bg-primary/10 border-primary/20 animate-in fade-in-0 zoom-in-95">
                <AlertTitle className="text-primary font-bold mb-3">4-Season Crop Rotation Plan</AlertTitle>
                <AlertDescription className="text-foreground/90 space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="p-3 bg-secondary rounded-lg shadow">
                            <span className="font-bold text-secondary-foreground">{selectedCrop}</span>
                          </div>
                           <span className="text-xs text-muted-foreground">Current Crop</span>
                        </div>
                        <ArrowRight className="w-5 h-5 text-primary/80 flex-shrink-0" />
                        <div className="flex flex-col items-center gap-1">
                          <div className="p-3 bg-accent/80 rounded-lg shadow">
                            <span className="font-bold text-accent-foreground">{recommendation.recommendations[0].recommendedCrop}</span>
                          </div>
                           <span className="text-xs text-muted-foreground">{recommendation.recommendations[0].season}</span>
                        </div>
                    </div>
                    <div className="w-full pl-12">
                      <p className="text-xs text-left">
                        <span className="font-semibold">Reason:</span> {recommendation.recommendations[0].reasoning}
                      </p>
                    </div>
                  </div>

                  <div className="pl-6 space-y-4">
                    {recommendation.recommendations.slice(1).map((rec, index) => {
                      const prevCrop = recommendation.recommendations[index].recommendedCrop;
                      return (
                        <div key={rec.season} className="flex flex-col">
                           <div className="flex items-center gap-2">
                              <CornerDownRight className="w-4 h-4 text-primary/70" />
                              <div className="p-2 bg-secondary/70 text-sm rounded-md shadow-sm">
                                  <span className="font-semibold text-secondary-foreground">{prevCrop}</span>
                              </div>
                               <ArrowRight className="w-4 h-4 text-primary/70" />
                               <div className="p-2 bg-accent/70 text-sm rounded-md shadow-sm">
                                  <span className="font-semibold text-accent-foreground">{rec.recommendedCrop}</span>
                               </div>
                                <span className='text-xs font-bold text-muted-foreground ml-2'>{rec.season}</span>
                           </div>
                           <div className="w-full pl-6 mt-1">
                              <p className="text-xs text-left">
                                <span className="font-semibold">Reason:</span> {rec.reasoning}
                              </p>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                </AlertDescription>
            </Alert>
        )}

        {bestPractices && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg max-h-64 overflow-y-auto space-y-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <h4 className="font-bold text-lg mb-2 text-primary/90">Best Practices for {selectedCrop}</h4>
            
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Droplet className="w-5 h-5 text-accent"/>
                    <h5 className="font-semibold text-primary">Watering</h5>
                </div>
                <p className="text-sm text-foreground/80 pl-7">{bestPractices.watering}</p>
            </div>
            
            <Separator />

            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Sprout className="w-5 h-5 text-accent"/>
                    <h5 className="font-semibold text-primary">Soil Health</h5>
                </div>
                <p className="text-sm text-foreground/80 pl-7">{bestPractices.soil}</p>
            </div>

            <Separator />

            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent"/>
                    <h5 className="font-semibold text-primary">General Tips</h5>
                </div>
                <p className="text-sm text-foreground/80 pl-7">{bestPractices.general}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
