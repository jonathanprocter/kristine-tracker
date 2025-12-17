import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, TrendingDown, TrendingUp, Award, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

export default function Progress() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  
  const { data: currentWeek } = trpc.user.getCurrentWeek.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const { data: allEntries } = trpc.entries.getByUser.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const { data: accommodations } = trpc.accommodations.getByUser.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const { data: allTasks } = trpc.tasks.getAll.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  if (!isAuthenticated) {
    return null;
  }
  
  // Calculate chart data
  const chartData = allEntries?.slice().reverse().map((entry, index) => ({
    name: format(new Date(entry.completedAt), 'MMM d'),
    anxiety: entry.anxietyLevel,
    guilt: entry.guiltLevel,
    week: entry.weekNumber,
  })) ?? [];
  
  // Calculate completion by week
  const weeklyCompletion: Record<number, { completed: number; total: number }> = {};
  allEntries?.forEach(entry => {
    if (!weeklyCompletion[entry.weekNumber]) {
      weeklyCompletion[entry.weekNumber] = { completed: 0, total: 0 };
    }
    weeklyCompletion[entry.weekNumber].total++;
    if (entry.completed) {
      weeklyCompletion[entry.weekNumber].completed++;
    }
  });
  
  // Calculate average anxiety and guilt
  const avgAnxiety = allEntries && allEntries.length > 0
    ? (allEntries.reduce((sum, e) => sum + e.anxietyLevel, 0) / allEntries.length).toFixed(1)
    : "N/A";
  const avgGuilt = allEntries && allEntries.length > 0
    ? (allEntries.reduce((sum, e) => sum + e.guiltLevel, 0) / allEntries.length).toFixed(1)
    : "N/A";
  
  // Calculate trends
  const recentEntries = allEntries?.slice(0, 5) ?? [];
  const olderEntries = allEntries?.slice(5, 10) ?? [];
  
  const recentAnxietyAvg = recentEntries.length > 0
    ? recentEntries.reduce((sum, e) => sum + e.anxietyLevel, 0) / recentEntries.length
    : 0;
  const olderAnxietyAvg = olderEntries.length > 0
    ? olderEntries.reduce((sum, e) => sum + e.anxietyLevel, 0) / olderEntries.length
    : recentAnxietyAvg;
  
  const anxietyTrend = recentAnxietyAvg < olderAnxietyAvg ? "decreasing" : 
                       recentAnxietyAvg > olderAnxietyAvg ? "increasing" : "stable";
  
  // Accommodation analysis (Weeks 1-2)
  const accommodationCount = accommodations?.length ?? 0;
  const couldHeDoItYes = accommodations?.filter(a => a.couldHeDoIt === 'yes').length ?? 0;
  const couldHeDoItPercent = accommodationCount > 0 
    ? Math.round((couldHeDoItYes / accommodationCount) * 100) 
    : 0;
  
  // Milestones
  const completedWeeks = Object.entries(weeklyCompletion)
    .filter(([week, data]) => {
      const task = allTasks?.find(t => t.weekNumber === parseInt(week));
      return task && data.completed >= task.goalDays;
    })
    .map(([week]) => parseInt(week));
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">My Progress</h1>
            <p className="text-sm text-muted-foreground">Week {currentWeek}</p>
          </div>
        </div>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">{avgAnxiety}</div>
              <div className="text-sm text-muted-foreground">Avg Anxiety</div>
              <div className={`text-xs mt-1 ${
                anxietyTrend === 'decreasing' ? 'text-primary' : 
                anxietyTrend === 'increasing' ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {anxietyTrend === 'decreasing' && '↓ Decreasing'}
                {anxietyTrend === 'increasing' && '↑ Increasing'}
                {anxietyTrend === 'stable' && '→ Stable'}
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-secondary">{avgGuilt}</div>
              <div className="text-sm text-muted-foreground">Avg Guilt</div>
              <div className="text-xs mt-1 text-muted-foreground">
                {allEntries?.length ?? 0} entries
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Anxiety & Guilt Trends Chart */}
        {chartData.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Emotional Trends
              </CardTitle>
              <CardDescription>Your anxiety and guilt levels over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
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
        
        {/* Milestones */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(week => {
              const task = allTasks?.find(t => t.weekNumber === week);
              const isCompleted = completedWeeks.includes(week);
              const isCurrent = week === currentWeek;
              
              return (
                <div 
                  key={week} 
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    isCompleted ? 'bg-primary/10' : 
                    isCurrent ? 'bg-secondary/10 border-2 border-secondary' : 
                    'bg-muted/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted ? 'bg-primary text-primary-foreground' : 
                    isCurrent ? 'bg-secondary text-secondary-foreground' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? '✓' : week}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{task?.taskName ?? `Week ${week}`}</div>
                    {isCurrent && <div className="text-xs text-muted-foreground">Current</div>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        
        {/* Accommodation Analysis (Weeks 1-2 only) */}
        {currentWeek && currentWeek <= 2 && accommodationCount > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-secondary" />
                Accommodation Patterns
              </CardTitle>
              <CardDescription>Analysis from Weeks 1-2</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{accommodationCount}</div>
                  <div className="text-sm text-muted-foreground">Total Logged</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{couldHeDoItPercent}%</div>
                  <div className="text-sm text-muted-foreground">He Could Do</div>
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-foreground">
                  <strong>Insight:</strong> {couldHeDoItPercent}% of your accommodations were things Brian could do himself. 
                  Building this awareness is the first step to change.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Supportive Message */}
        <Card className="shadow-md bg-secondary/10 border-secondary/30">
          <CardContent className="pt-6">
            <p className="text-sm text-center italic text-foreground">
              "Every day you track is progress. You're building new patterns that will help both you and Brian."
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
