import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Heart, Calendar, TrendingDown, Settings, ClipboardList, MessageCircle, BarChart3, RefreshCw, Volume2, VolumeX, Pause, PenLine, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

// Fallback affirmations (softer language, no "boundaries")
const FALLBACK_AFFIRMATIONS = [
  "Taking care of yourself helps you take care of Brian.",
  "Your feelings are valid. Change takes time.",
  "Brian is more capable than his anxiety tells you.",
  "Self-care is not selfish. It's necessary.",
  "Progress isn't linear. Every small step matters.",
  "You deserve rest and peace.",
  "Guilt is a feeling, not a fact.",
  "By caring for yourself, you're showing Brian how to do the same.",
  "Your needs matter too.",
  "You're doing something brave and difficult.",
];

const TASK_PHASES = [
  { weeks: [1, 2], name: "Accommodation Awareness", description: "Notice and log the things you do for Brian that he could do himself. Just observe - no pressure to change yet." },
  { weeks: [3, 4], name: "The 15-Minute Exit", description: "Give yourself 15 minutes away from home each day. A short walk, a coffee run - just a small break for you." },
  { weeks: [5, 6], name: "Self-Care Hour", description: "Take one hour for yourself daily. Do something that fills YOUR cup - reading, a bath, calling a friend." },
  { weeks: [7, 8], name: "Validation Practice", description: "When Brian expresses worry, acknowledge his feelings once, then gently move on. You don't need to fix everything." },
  { weeks: [9], name: "Reclaiming Your Space", description: "Sleep in your own bed. Brian can learn to manage nighttime worries, and you need proper rest." },
];

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [affirmationKey, setAffirmationKey] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Get recent entries for context
  const { data: currentWeek, isLoading: weekLoading } = trpc.user.getCurrentWeek.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const { data: currentTask } = trpc.tasks.getByWeek.useQuery(
    { weekNumber: currentWeek ?? 1 },
    { enabled: !!currentWeek }
  );
  
  const { data: weekEntries } = trpc.entries.getByWeek.useQuery(
    { weekNumber: currentWeek ?? 1 },
    { enabled: !!currentWeek }
  );
  
  // Calculate recent stats for AI context
  const recentStats = useMemo(() => {
    if (!weekEntries || weekEntries.length === 0) return null;
    const recent = weekEntries.slice(0, 3);
    return {
      recentAnxiety: Math.round(recent.reduce((sum, e) => sum + e.anxietyLevel, 0) / recent.length),
      recentGuilt: Math.round(recent.reduce((sum, e) => sum + e.guiltLevel, 0) / recent.length),
      completedDays: weekEntries.filter(e => e.completed).length,
    };
  }, [weekEntries]);
  
  // AI-powered affirmation
  const { data: aiAffirmation, isLoading: affirmationLoading, refetch: refetchAffirmation } = trpc.ai.getAffirmation.useQuery(
    {
      weekNumber: currentWeek ?? 1,
      recentAnxiety: recentStats?.recentAnxiety,
      recentGuilt: recentStats?.recentGuilt,
      completedDays: recentStats?.completedDays,
    },
    { 
      enabled: isAuthenticated && !!currentWeek,
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    }
  );
  
  // TTS mutation
  const ttsMutation = trpc.ai.textToSpeech.useMutation();
  
  // Fallback affirmation
  const fallbackAffirmation = useMemo(() => {
    return FALLBACK_AFFIRMATIONS[Math.floor(Math.random() * FALLBACK_AFFIRMATIONS.length)];
  }, [affirmationKey]);
  
  const displayAffirmation = aiAffirmation?.affirmation || fallbackAffirmation;
  
  // Seed tasks on first load
  const seedMutation = trpc.tasks.seed.useMutation();
  useEffect(() => {
    if (isAuthenticated && currentTask === null && !seedMutation.isPending) {
      seedMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentTask]);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [loading, isAuthenticated, setLocation]);
  
  // Cleanup audio on unmount - properly remove event listeners to prevent memory leaks
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.src = ""; // Release the audio resource
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayAffirmation = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    setAudioLoading(true);
    try {
      const result = await ttsMutation.mutateAsync({ text: displayAffirmation });

      // Clean up previous audio instance if exists
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.src = "";
      }

      const audio = new Audio(result.audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        toast.error("Failed to play audio");
      };

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      toast.error("Failed to generate audio");
    } finally {
      setAudioLoading(false);
    }
  };
  
  if (loading || weekLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  const currentPhase = TASK_PHASES.find(phase => phase.weeks.includes(currentWeek ?? 1)) ?? TASK_PHASES[0];
  const completedDays = weekEntries?.filter(e => e.completed).length ?? 0;
  const goalDays = currentTask?.goalDays ?? 5;
  
  // Calculate which days have entries this week (Monday = 0, Sunday = 6)
  const today = new Date();
  const jsDay = today.getDay(); // JS: 0 = Sunday
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // Convert to Monday-first (Mon=0, Sun=6)
  const daysWithEntries = new Set(
    weekEntries?.map(e => {
      const jsD = new Date(e.completedAt).getDay();
      return jsD === 0 ? 6 : jsD - 1; // Convert to Monday-first
    }) ?? []
  );
  
  const handleRefreshAffirmation = () => {
    setAffirmationKey(k => k + 1);
    refetchAffirmation();
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Safe area top padding */}
      <div className="pt-safe" />
      
      <div className="flex-1 container max-w-lg py-6 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2 relative">
          <Link href="/settings" className="absolute right-0 top-0">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Kristine's Self-Care Tracker</h1>
          
          {/* AI Affirmation with TTS */}
          <div className="flex items-center justify-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 opacity-70 hover:opacity-100"
              onClick={handlePlayAffirmation}
              disabled={audioLoading || affirmationLoading}
            >
              {audioLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 text-primary" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <p className="text-muted-foreground italic text-sm px-2 flex-1">
              {affirmationLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>...</span>
                </span>
              ) : (
                displayAffirmation
              )}
            </p>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 opacity-50 hover:opacity-100"
              onClick={handleRefreshAffirmation}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* Current Week Task */}
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              This Week (Week {currentWeek})
            </CardTitle>
            <CardDescription className="text-base font-medium text-foreground">
              {currentPhase.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {currentPhase.description}
            </p>
            
            {/* Weekly Progress Calendar - Monday first */}
            <div className="flex justify-between gap-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                <div 
                  key={day} 
                  className={`flex-1 py-3 rounded-lg text-center text-xs font-medium transition-colors ${
                    daysWithEntries.has(index) 
                      ? 'bg-primary text-primary-foreground' 
                      : index === dayOfWeek
                      ? 'bg-secondary/30 border-2 border-secondary'
                      : 'bg-muted/50'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Progress Stats */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{completedDays}/7 days</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Goal</span>
              <span className="font-medium">{goalDays}+ days 🎯</span>
            </div>
            
            {/* Main CTA */}
            <Link href="/check-in">
              <Button className="w-full h-12 text-base rounded-xl" size="lg">
                Log Today's Activity
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          {/* Accommodation Log - Only show for weeks 1-2 */}
          {(currentWeek ?? 1) <= 2 && (
            <Link href="/accommodations">
              <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="pt-5 pb-5 flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center mb-2">
                    <TrendingDown className="h-5 w-5 text-secondary" />
                  </div>
                  <span className="font-medium text-sm">Accommodation Log</span>
                  <span className="text-xs text-muted-foreground">Notice patterns (Weeks 1-2)</span>
                </CardContent>
              </Card>
            </Link>
          )}
          
          {/* Weekly Reflections */}
          <Link href="/reflections">
            <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="pt-5 pb-5 flex flex-col items-center text-center">
                <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center mb-2">
                  <MessageCircle className="h-5 w-5 text-secondary" />
                </div>
                <span className="font-medium text-sm">Weekly Reflections</span>
                <span className="text-xs text-muted-foreground">Guided questions</span>
              </CardContent>
            </Card>
          </Link>
          
          {/* Progress Dashboard */}
          <Link href="/progress">
            <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="pt-5 pb-5 flex flex-col items-center text-center">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center mb-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium text-sm">Progress</span>
                <span className="text-xs text-muted-foreground">View your journey</span>
              </CardContent>
            </Card>
          </Link>
          
          {/* Journal */}
          <Link href="/journal">
            <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="pt-5 pb-5 flex flex-col items-center text-center">
                <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center mb-2">
                  <PenLine className="h-5 w-5 text-secondary" />
                </div>
                <span className="font-medium text-sm">Journal</span>
                <span className="text-xs text-muted-foreground">Write freely</span>
              </CardContent>
            </Card>
          </Link>

          {/* Chat with Journey */}
          <Link href="/chat">
            <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full border-primary/30 bg-primary/5">
              <CardContent className="pt-5 pb-5 flex flex-col items-center text-center">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center mb-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium text-sm">Talk to Journey</span>
                <span className="text-xs text-muted-foreground">Get support anytime</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
      
      {/* Safe area bottom padding */}
      <div className="pb-safe" />
    </div>
  );
}
