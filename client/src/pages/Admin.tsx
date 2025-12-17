import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, AlertTriangle, Activity, Calendar, Download, TrendingDown, User, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  // Fetch Kristine's actual user ID dynamically
  const { data: kristineUserId, isLoading: kristineIdLoading } = trpc.admin.getKristineUserId.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === 'admin' }
  );

  const { data: userActivity, isLoading: activityLoading } = trpc.admin.getUserActivity.useQuery(
    { userId: kristineUserId ?? 0 },
    { enabled: isAuthenticated && user?.role === 'admin' && !!kristineUserId }
  );

  const { data: redFlags, isLoading: redFlagsLoading } = trpc.admin.getRedFlags.useQuery(
    { userId: kristineUserId ?? 0 },
    { enabled: isAuthenticated && user?.role === 'admin' && !!kristineUserId }
  );

  const { data: loginTracking, isLoading: loginLoading } = trpc.admin.getLoginTracking.useQuery(
    { userId: kristineUserId ?? 0 },
    { enabled: isAuthenticated && user?.role === 'admin' && !!kristineUserId }
  );
  
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="shadow-md max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-foreground">Admin access required</p>
            <Button onClick={() => setLocation("/")}>Return Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state while fetching Kristine's data
  const isLoading = kristineIdLoading || activityLoading || redFlagsLoading || loginLoading;

  if (kristineIdLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!kristineUserId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="shadow-md max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <User className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-foreground">Kristine hasn't logged in yet</p>
            <p className="text-sm text-muted-foreground">
              Once Kristine logs in for the first time, her data will appear here.
            </p>
            <Button onClick={() => setLocation("/")}>Return Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const entries = userActivity?.entries ?? [];
  const accommodations = userActivity?.accommodations ?? [];
  const reflections = userActivity?.reflections ?? [];
  
  // Chart data for anxiety/guilt trends
  const trendData = entries.slice().reverse().map((entry) => ({
    name: format(new Date(entry.completedAt), 'MMM d'),
    anxiety: entry.anxietyLevel,
    guilt: entry.guiltLevel,
    week: entry.weekNumber,
  }));
  
  // Completion rate by week
  const weeklyData: Record<number, { completed: number; total: number }> = {};
  entries.forEach(entry => {
    if (!weeklyData[entry.weekNumber]) {
      weeklyData[entry.weekNumber] = { completed: 0, total: 0 };
    }
    weeklyData[entry.weekNumber].total++;
    if (entry.completed) {
      weeklyData[entry.weekNumber].completed++;
    }
  });
  
  const completionChartData = Object.entries(weeklyData).map(([week, data]) => ({
    week: `Week ${week}`,
    completed: data.completed,
    total: data.total,
    rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
  }));
  
  // Accommodation patterns
  const accommodationByTime: Record<string, number> = {};
  accommodations.forEach(acc => {
    const hour = parseInt(acc.timeOfDay.split(':')[0] ?? '12');
    const period = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
    accommodationByTime[period] = (accommodationByTime[period] ?? 0) + 1;
  });
  
  const accommodationChartData = Object.entries(accommodationByTime).map(([period, count]) => ({
    period,
    count,
  }));
  
  // Export data function
  const handleExport = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      entries: entries.map(e => ({
        date: format(new Date(e.completedAt), 'yyyy-MM-dd'),
        week: e.weekNumber,
        completed: e.completed,
        anxiety: e.anxietyLevel,
        guilt: e.guiltLevel,
        activity: e.activityDescription,
        observation: e.observationAboutBrian,
      })),
      accommodations: accommodations.map(a => ({
        date: format(new Date(a.loggedAt), 'yyyy-MM-dd'),
        time: a.timeOfDay,
        what: a.whatDid,
        couldHeDoIt: a.couldHeDoIt,
        feeling: a.whatFelt,
      })),
      reflections: reflections.map(r => ({
        week: r.weekNumber,
        q1: r.question1Answer,
        q2: r.question2Answer,
        q3: r.question3Answer,
      })),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kristine-data-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Data exported successfully");
  };
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Monitoring Kristine's Progress</p>
            </div>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
        
        {/* Red Flags */}
        {redFlags && redFlags.length > 0 && (
          <Card className="shadow-md border-destructive bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Red Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {redFlags.map((flag, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-destructive" />
                    {flag}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">{entries.length}</div>
              <div className="text-sm text-muted-foreground">Total Entries</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-secondary">{accommodations.length}</div>
              <div className="text-sm text-muted-foreground">Accommodations</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">{reflections.length}</div>
              <div className="text-sm text-muted-foreground">Reflections</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-secondary">{loginTracking?.length ?? 0}</div>
              <div className="text-sm text-muted-foreground">Logins</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Anxiety/Guilt Trends */}
        {trendData.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Anxiety & Guilt Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="anxiety" 
                      stroke="#8FA998" 
                      strokeWidth={2}
                      dot={{ fill: '#8FA998' }}
                      name="Anxiety"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="guilt" 
                      stroke="#B4A7D6" 
                      strokeWidth={2}
                      dot={{ fill: '#B4A7D6' }}
                      name="Guilt"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Completion Rate by Week */}
        {completionChartData.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Completion Rate by Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="completed" fill="#8FA998" name="Completed Days" />
                    <Bar dataKey="total" fill="#B4A7D6" name="Total Entries" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Accommodation Patterns */}
        {accommodationChartData.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-secondary" />
                Accommodation Patterns (Weeks 1-2)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accommodationChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="count" fill="#B4A7D6" name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Recent Activity Log */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {entries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">
                      {format(new Date(entry.completedAt), 'MMM d, yyyy h:mm a')}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      entry.completed 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {entry.completed ? 'Completed' : 'Not completed'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Week {entry.weekNumber} • Anxiety: {entry.anxietyLevel}/10 • Guilt: {entry.guiltLevel}/10
                  </div>
                  {entry.activityDescription && (
                    <p className="text-sm">{entry.activityDescription}</p>
                  )}
                  {entry.observationAboutBrian && (
                    <p className="text-xs italic text-muted-foreground">
                      Observation: {entry.observationAboutBrian}
                    </p>
                  )}
                </div>
              ))}
              
              {entries.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No entries yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Login Activity */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Login Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {loginTracking?.slice(0, 20).map((login) => (
                <div key={login.id} className="flex justify-between text-sm p-2 rounded bg-muted/50">
                  <span>{format(new Date(login.loggedInAt), 'MMM d, yyyy')}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(login.loggedInAt), 'h:mm a')}
                  </span>
                </div>
              ))}
              
              {(!loginTracking || loginTracking.length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  No login activity recorded
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
