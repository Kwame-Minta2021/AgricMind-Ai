import { Leaf } from 'lucide-react';

export function Header() {
  return (
    <header className="mb-8 animate-in fade-in-0 duration-300">
      <div className="flex items-center gap-3 mb-2">
        <Leaf className="w-8 h-8 text-primary" />
        <h1 className="text-4xl font-bold font-headline text-primary/90">AgriMind AI</h1>
      </div>
      <p className="text-lg text-muted-foreground">
        Smart Greenhouse Monitoring and Automation Dashboard
      </p>
    </header>
  );
}
