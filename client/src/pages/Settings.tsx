import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Settings as SettingsIcon, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: currentWeek } = trpc.user.getCurrentWeek.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const updateWeekMutation = trpc.user.updateWeek.useMutation({
    onSuccess: () => {
      utils.user.invalidate();
      utils.tasks.invalidate();
      toast.success("Week updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update week", {
        description: error.message,
      });
    },
  });
  
  const handleWeekChange = (value: string) => {
    updateWeekMutation.mutate({ weekNumber: parseInt(value) });
  };
  
  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account</p>
          </div>
        </div>
        
        {/* Profile */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user?.name ?? 'Not set'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email ?? 'Not set'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Role</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                user?.role === 'admin' 
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {user?.role === 'admin' ? 'Admin (Therapist)' : 'User'}
              </span>
            </div>
          </CardContent>
        </Card>
        
        {/* Week Management */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Program Week</CardTitle>
            <CardDescription>
              Adjust your current week in the program
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Current Week</span>
              <Select 
                value={currentWeek?.toString()} 
                onValueChange={handleWeekChange}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(week => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p><strong>Week 1-2:</strong> Awareness Building</p>
              <p><strong>Week 3-4:</strong> 15-Minute Break</p>
              <p><strong>Week 5-6:</strong> Self-Care Hour</p>
              <p><strong>Week 7-8:</strong> Validation Practice</p>
              <p><strong>Week 9+:</strong> Reclaiming Your Space</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Logout */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
