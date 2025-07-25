"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Loader2, Sparkles, Droplet, Sprout, CheckCircle, ArrowRight } from 'lucide-react';
import { getCropBestPractices, CropBestPracticesOutput } from '@/ai/flows/best-practices';
import { cropRecommendation, CropRecommendationOutput } from '@/ai/flows/crop-recommendation';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const crops = ["Onion", "Carrot", "Potato", "Tomato", "Lettuce", "Wheat", "Corn", "Soybean"];

interface CropManagementProps {
  onNewInsight: (insight: string) => void;
}

export function CropManagement({ onNewInsight }: CropManagementProps) {
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
      const [practicesResult, recommendationResult] = await Promise.all([
        getCropBestPractices({ crop: selectedCrop }),
        cropRecommendation({ currentCrop: selectedCrop })
      ]);
      
      setBestPractices(practicesResult);
      onNewInsight(`Best practices for ${selectedCrop} loaded.`);
      
      setRecommendation(recommendationResult);
      onNewInsight(`Crop rotation advice for ${selectedCrop} is ready.`);

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
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 bg-card/80 backdrop-blur-sm">
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
                <AlertTitle className="text-primary font-bold mb-3">Crop Rotation Recommendation</AlertTitle>
                <AlertDescription className="text-foreground/90 space-y-2">
                  <div className="flex items-center justify-center gap-2 md:gap-4">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <div className="p-3 bg-secondary rounded-lg shadow">
                        <span className="font-bold text-secondary-foreground">{selectedCrop}</span>
                      </div>
                       <span className="text-xs text-muted-foreground">Current Crop</span>
                    </div>
                    <ArrowRight className="w-6 h-6 text-primary flex-shrink-0" />
                    <div className="flex flex-col items-center gap-1 text-center">
                      <div className="p-3 bg-accent rounded-lg shadow">
                        <span className="font-bold text-accent-foreground">{recommendation.recommendedCrop}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Next Crop</span>
                    </div>
                  </div>
                  <p className="text-center pt-2">{recommendation.reasoning}</p>
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
