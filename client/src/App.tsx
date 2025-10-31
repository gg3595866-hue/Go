import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import FixturesPage from "@/pages/fixtures";
import DatabasePage from "@/pages/database";
import TesterPage from "@/pages/tester";
import TrainingPage from "@/pages/training";
import ProcessingPage from "@/pages/processing";
import MatchDetailsPage from "@/pages/match-details";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={FixturesPage} />
      <Route path="/database" component={DatabasePage} />
      <Route path="/tester" component={TesterPage} />
      <Route path="/training" component={TrainingPage} />
      <Route path="/processing" component={ProcessingPage} />
      <Route path="/match/:url" component={MatchDetailsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function NavigationTabs() {
  const [location] = useLocation();
  
  const tabs = [
    { name: "Fixtures", path: "/" },
    { name: "Database", path: "/database" },
    { name: "Tester", path: "/tester" },
    { name: "Training", path: "/training" },
    { name: "Processing", path: "/processing" },
  ];
  
  return (
    <div className="border-b bg-background">
      <div className="flex items-center px-4">
        {tabs.map((tab) => {
          const isActive = location === tab.path;
          return (
            <Link key={tab.path} href={tab.path}>
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
                data-testid={`button-tab-${tab.name.toLowerCase()}`}
              >
                {tab.name}
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <NavigationTabs />
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
