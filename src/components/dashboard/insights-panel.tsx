import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InsightsPanelProps {
  insights: string[];
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 col-span-1 md:col-span-2 lg:col-span-3 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <CardTitle>AI Insights & Recommendations</CardTitle>
        </div>
        <CardDescription>Real-time advice from AgriMind AI.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 w-full pr-4">
          {insights.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Interact with AI controls to generate recommendations.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {insights.map((insight, index) => (
                <li key={index} className="flex items-start gap-3 animate-in fade-in-0 duration-500">
                  <Lightbulb className="w-5 h-5 mt-1 text-accent flex-shrink-0" />
                  <p className="text-sm text-foreground/90">{insight}</p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
