import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import FixturesPage from "@/pages/fixtures";
import BasketballPage from "@/pages/basketball";
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
      <Route path="/football" component={FixturesPage} />
      <Route path="/football/database" component={DatabasePage} />
      <Route path="/football/tester" component={TesterPage} />
      <Route path="/football/training" component={TrainingPage} />
      <Route path="/football/processing" component={ProcessingPage} />
      <Route path="/basketball" component={BasketballPage} />
      <Route path="/match/:url" component={MatchDetailsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function NavigationTabs() {
  const [location] = useLocation();
  
  const isFootball = location === '/' || location.startsWith('/football');
  const isBasketball = location.startsWith('/basketball');
  
  const sportTabs = [
    { name: "Football", path: "/football" },
    { name: "Basketball", path: "/basketball" },
  ];
  
  const footballSubTabs = [
    { name: "Fixtures", path: "/football" },
    { name: "Database", path: "/football/database" },
    { name: "Tester", path: "/football/tester" },
    { name: "Training", path: "/football/training" },
    { name: "Processing", path: "/football/processing" },
  ];
  
  const basketballSubTabs = [
    { name: "Fixtures", path: "/basketball" },
  ];
  
  const currentSubTabs = isBasketball ? basketballSubTabs : footballSubTabs;
  
  return (
    <div className="border-b bg-background">
      <div className="flex items-center px-4 border-b">
        {sportTabs.map((tab) => {
          const isActive = (tab.path === '/football' && isFootball) || (tab.path === '/basketball' && isBasketball);
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
      <div className="flex items-center px-4">
        {currentSubTabs.map((tab) => {
          const isActive = location === tab.path;
          return (
            <Link key={tab.path} href={tab.path}>
              <button
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
                data-testid={`button-subtab-${tab.name.toLowerCase()}`}
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
