import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import CheckIn from "./pages/CheckIn";
import Accommodations from "./pages/Accommodations";
import Reflections from "./pages/Reflections";
import Progress from "./pages/Progress";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import Journal from "./pages/Journal";
import Chat from "./pages/Chat";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/check-in" component={CheckIn} />
      <Route path="/accommodations" component={Accommodations} />
      <Route path="/reflections" component={Reflections} />
      <Route path="/progress" component={Progress} />
      <Route path="/admin" component={Admin} />
      <Route path="/settings" component={Settings} />
      <Route path="/journal" component={Journal} />
      <Route path="/chat" component={Chat} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
