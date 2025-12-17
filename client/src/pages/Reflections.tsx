import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, MessageCircle, TrendingDown, CheckCircle2, BarChart3, Sparkles, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const REFLECTION_QUESTIONS: Record<number, string[]> = {
  1: [
    "What patterns do you notice in when and how you help Brian?",
    "What feelings come up most often when you step in to help?",
    "What do you imagine might happen if you stepped back in those moments?",
  ],
  2: [
    "How has your awareness changed this week?",
    "Which situations feel hardest to step back from?",
    "What did you learn about yourself this week?",
  ],
  3: [
    "What did you notice about Brian when you returned from your 15-minute break?",
    "How did your feelings change while you were away?",
    "What did you do during your time for yourself?",
  ],
  4: [
    "Is taking your break getting easier or harder?",
    "How has Brian been responding to your time away?",
    "How do you feel about giving yourself this time?",
  ],
  5: [
    "How did taking time for yourself affect your mood?",
    "What self-care activities did you enjoy most?",
    "How did Brian respond to you taking an hour for yourself?",
  ],
  6: [
    "Is self-care feeling more natural now?",
    "What got in the way this week?",
    "How has your relationship with Brian changed?",
  ],
  7: [
    "How did Brian respond when you acknowledged his feelings without stepping in?",
    "What was the hardest part of 'acknowledge and let go'?",
    "What did you notice about Brian's ability to manage?",
  ],
  8: [
    "Is this practice getting easier?",
    "How has Brian's worry level changed?",
    "What have you learned about what Brian can handle?",
  ],
  9: [
    "How is your relationship with Brian changing?",
    "How does it feel to sleep in your own bed?",
    "What progress are you most proud of?",
  ],
};

const PHASE_NAMES: Record<number, string> = {
  1: "Awareness Building",
  2: "Awareness Building",
  3: "15-Minute Break",
  4: "15-Minute Break",
  5: "Self-Care Hour",
  6: "Self-Care Hour",
  7: "Validation Practice",
  8: "Validation Practice",
  9: "Reclaiming Your Space",
};

export default function Reflections() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: currentWeek } = trpc.user.getCurrentWeek.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const { data: existingReflection } = trpc.reflections.getByWeek.useQuery(
    { weekNumber: currentWeek ?? 1 },
    { enabled: !!currentWeek }
  );
  
  const { data: allReflections } = trpc.reflections.getByUser.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const { data: weekEntries } = trpc.entries.getByWeek.useQuery(
    { weekNumber: currentWeek ?? 1 },
    { enabled: !!currentWeek }
  );
  
  const { data: allEntries } = trpc.entries.getByUser.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [showSummary, setShowSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  
  const summaryMutation = trpc.ai.getWeeklySummary.useMutation();
  
  useEffect(() => {
    if (existingReflection) {
      setAnswers([
        existingReflection.question1Answer ?? "",
        existingReflection.question2Answer ?? "",
        existingReflection.question3Answer ?? "",
      ]);
    }
  }, [existingReflection]);
  
  // Calculate weekly stats for charts
  const weeklyStats = useMemo(() => {
    if (!weekEntries || weekEntries.length === 0) return null;
    
    const sortedEntries = [...weekEntries].sort((a, b) => 
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );
    
    const chartData = sortedEntries.map((entry, index) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index] || `Day ${index + 1}`,
      anxiety: entry.anxietyLevel,
      guilt: entry.guiltLevel,
      completed: entry.completed ? 1 : 0,
    }));
    
    const avgAnxiety = sortedEntries.reduce((sum, e) => sum + e.anxietyLevel, 0) / sortedEntries.length;
    const avgGuilt = sortedEntries.reduce((sum, e) => sum + e.guiltLevel, 0) / sortedEntries.length;
    const completionRate = (sortedEntries.filter(e => e.completed).length / 7) * 100;
    
    return {
      chartData,
      avgAnxiety: avgAnxiety.toFixed(1),
      avgGuilt: avgGuilt.toFixed(1),
      completionRate: Math.round(completionRate),
      totalDays: sortedEntries.length,
      completedDays: sortedEntries.filter(e => e.completed).length,
    };
  }, [weekEntries]);
  
  const createReflectionMutation = trpc.reflections.create.useMutation({
    onSuccess: async () => {
      utils.reflections.invalidate();
      
      // Show summary report
      setSummaryLoading(true);
      setShowSummary(true);
      
      try {
        // Server now fetches all stats from DB for security - just pass week number
        const result = await summaryMutation.mutateAsync({
          weekNumber: currentWeek ?? 1,
        });
        setAiSummary(result.summary);
      } catch (error) {
        setAiSummary("You've completed another week of your journey. Every step forward, no matter how small, is progress worth celebrating.");
      } finally {
        setSummaryLoading(false);
      }
    },
    onError: (error) => {
      toast.error("Failed to save reflection", {
        description: error.message,
      });
    },
  });
  
  const handleSubmit = () => {
    if (!currentWeek) return;
    
    createReflectionMutation.mutate({
      weekNumber: currentWeek,
      question1Answer: answers[0] || undefined,
      question2Answer: answers[1] || undefined,
      question3Answer: answers[2] || undefined,
    });
  };
  
  if (!isAuthenticated) {
    return null;
  }
  
  const questions = REFLECTION_QUESTIONS[currentWeek ?? 1] ?? REFLECTION_QUESTIONS[9];
  const phaseName = PHASE_NAMES[currentWeek ?? 1] ?? "Your Journey";
  
  return (
    <div className="min-h-screen bg-background">
      <div className="pt-safe" />
      
      <div className="container max-w-lg py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Weekly Reflections</h1>
            <p className="text-sm text-muted-foreground">Week {currentWeek} - {phaseName}</p>
          </div>
        </div>
        
        {/* Current Week Reflection */}
        <Card className="shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-secondary" />
              This Week's Reflection
            </CardTitle>
            <CardDescription>
              Take a moment to reflect on your progress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {questions.map((question, index) => (
              <div key={index} className="space-y-2">
                <Label className="text-sm font-medium">{question}</Label>
                <Textarea
                  placeholder="Your thoughts..."
                  value={answers[index]}
                  onChange={(e) => {
                    const newAnswers = [...answers];
                    newAnswers[index] = e.target.value;
                    setAnswers(newAnswers);
                  }}
                  rows={3}
                  className="text-base"
                />
              </div>
            ))}
            
            <Button
              onClick={handleSubmit}
              disabled={createReflectionMutation.isPending}
              className="w-full h-12 rounded-xl"
              size="lg"
            >
              {createReflectionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Summary...
                </>
              ) : existingReflection ? (
                "Update & View Summary"
              ) : (
                "Complete Week & View Summary"
              )}
            </Button>
          </CardContent>
        </Card>
        
        {/* Past Reflections */}
        {allReflections && allReflections.length > 0 && (
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Past Reflections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {allReflections
                .filter(r => r.weekNumber !== currentWeek)
                .slice(0, 3)
                .map((reflection) => {
                  const weekQuestions = REFLECTION_QUESTIONS[reflection.weekNumber] ?? REFLECTION_QUESTIONS[9];
                  return (
                    <div key={reflection.id} className="p-4 rounded-xl bg-muted/50 space-y-2">
                      <h4 className="font-medium text-sm">Week {reflection.weekNumber} - {PHASE_NAMES[reflection.weekNumber]}</h4>
                      {reflection.question1Answer && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{reflection.question1Answer}</p>
                      )}
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        )}
      </div>
      
      <div className="pb-safe" />
      
      {/* Weekly Summary Report Dialog */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Week {currentWeek} Summary
            </DialogTitle>
          </DialogHeader>
          
          <div id="weekly-report" className="space-y-5 py-2 bg-background">
            {/* Calming breathing animation while loading */}
            {summaryLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-primary/20 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary/40 animate-ping" style={{ animationDuration: '2s' }} />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Creating your personalized summary...
                </p>
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                {weeklyStats && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-primary">{weeklyStats.completedDays}</div>
                      <div className="text-xs text-muted-foreground">Days Done</div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-orange-500">{weeklyStats.avgAnxiety}</div>
                      <div className="text-xs text-muted-foreground">Avg Anxiety</div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-purple-500">{weeklyStats.avgGuilt}</div>
                      <div className="text-xs text-muted-foreground">Avg Guilt</div>
                    </div>
                  </div>
                )}
                
                {/* Anxiety & Guilt Trend Chart */}
                {weeklyStats && weeklyStats.chartData.length > 1 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                      Anxiety & Guilt Trends
                    </h4>
                    <div className="h-40 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyStats.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="anxiety" 
                            stroke="#f97316" 
                            strokeWidth={2}
                            dot={{ fill: '#f97316', r: 3 }}
                            name="Anxiety"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="guilt" 
                            stroke="#a855f7" 
                            strokeWidth={2}
                            dot={{ fill: '#a855f7', r: 3 }}
                            name="Guilt"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                
                {/* Completion Chart */}
                {weeklyStats && weeklyStats.chartData.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      Daily Completion
                    </h4>
                    <div className="h-24 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyStats.chartData}>
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                          <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                            {weeklyStats.chartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.completed ? '#8FA998' : '#e5e5e5'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                
                {/* AI Summary */}
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Your Personalized Summary
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed">
                    {aiSummary}
                  </p>
                </div>
              </>
            )}
          </div>
          
          {!summaryLoading && (
            <div className="space-y-2">
              <Button 
                onClick={async () => {
                  setExportingPdf(true);
                  try {
                    const reportElement = document.getElementById('weekly-report');
                    if (!reportElement) {
                      toast.error('Could not find report to export');
                      return;
                    }
                    
                    const canvas = await html2canvas(reportElement, {
                      scale: 2,
                      backgroundColor: '#FAF9F6',
                      logging: false,
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF({
                      orientation: 'portrait',
                      unit: 'mm',
                      format: 'a4',
                    });
                    
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = pdf.internal.pageSize.getHeight();
                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
                    const imgX = (pdfWidth - imgWidth * ratio) / 2;
                    const imgY = 10;
                    
                    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
                    pdf.save(`kristine-week-${currentWeek}-summary.pdf`);
                    
                    toast.success('PDF exported successfully!');
                  } catch (error) {
                    console.error('PDF export error:', error);
                    toast.error('Failed to export PDF');
                  } finally {
                    setExportingPdf(false);
                  }
                }}
                variant="outline"
                className="w-full h-11 rounded-xl"
                disabled={exportingPdf}
              >
                {exportingPdf ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export as PDF
                  </>
                )}
              </Button>
              <Button 
                onClick={() => {
                  setShowSummary(false);
                  setLocation("/");
                }} 
                className="w-full h-11 rounded-xl"
              >
                Continue
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
