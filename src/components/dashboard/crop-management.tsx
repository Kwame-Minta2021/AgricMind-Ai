"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Loader2, Sparkles } from 'lucide-react';
import { getCropBestPractices } from '@/ai/flows/best-practices';
import { cropRecommendation } from '@/ai/flows/crop-recommendation';
import { useToast } from "@/hooks/use-toast";

const crops = ["Onion", "Carrot", "Potato", "Tomato", "Lettuce", "Wheat", "Corn", "Soybean"];

interface CropManagementProps {
  onNewInsight: (insight: string) => void;
}

export function CropManagement({ onNewInsight }: CropManagementProps) {
  const [selectedCrop, setSelectedCrop] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [bestPractices, setBestPractices] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGetRecommendations = async () => {
    if (!selectedCrop) return;

    setIsLoading(true);
    setBestPractices(null);

    try {
      onNewInsight(`Fetching AI advice for ${selectedCrop}...`);
      const [practicesResult, recommendationResult] = await Promise.all([
        getCropBestPractices({ crop: selectedCrop }),
        cropRecommendation({ currentCrop: selectedCrop })
      ]);
      
      setBestPractices(practicesResult.bestPractices);
      onNewInsight(`Best practices for ${selectedCrop} loaded.`);
      
      onNewInsight(`For next season, plant ${recommendationResult.recommendedCrop}. ${recommendationResult.reasoning}`);

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

        {bestPractices && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg max-h-48 overflow-y-auto">
            <h4 className="font-bold mb-2 text-primary/90">Best Practices for {selectedCrop}</h4>
            <p className="text-sm text-foreground/80">{bestPractices}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
