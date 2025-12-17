import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Heart, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function CheckIn() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: currentWeek } = trpc.user.getCurrentWeek.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const { data: currentTask } = trpc.tasks.getByWeek.useQuery(
    { weekNumber: currentWeek ?? 1 },
    { enabled: !!currentWeek }
  );
  
  const [completed, setCompleted] = useState(false);
  const [anxietyLevel, setAnxietyLevel] = useState([5]);
  const [guiltLevel, setGuiltLevel] = useState([5]);
  const [activityDescription, setActivityDescription] = useState("");
  const [observationAboutBrian, setObservationAboutBrian] = useState("");
  
  // AI feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  
  const feedbackMutation = trpc.ai.getCheckInFeedback.useMutation();
  
  const createEntryMutation = trpc.entries.create.useMutation({
    onSuccess: async () => {
      utils.entries.invalidate();
      utils.user.invalidate();
      
      // Get AI feedback
      setFeedbackLoading(true);
      setShowFeedback(true);
      
      try {
        const result = await feedbackMutation.mutateAsync({
          weekNumber: currentWeek ?? 1,
          completed,
          anxietyLevel: anxietyLevel[0] ?? 5,
          guiltLevel: guiltLevel[0] ?? 5,
          activityDescription: activityDescription.trim() || undefined,
          observationAboutBrian: observationAboutBrian.trim() || undefined,
        });
        setAiFeedback(result.feedback);
      } catch (error) {
        // Fallback message
        setAiFeedback(completed 
          ? "Well done! Taking time for yourself is an act of love - for both you and Brian." 
          : "Thank you for checking in today. Every day is a new opportunity, and showing up matters."
        );
      } finally {
        setFeedbackLoading(false);
      }
    },
    onError: (error) => {
      toast.error("Failed to save check-in", {
        description: error.message,
      });
    },
  });
  
  const handleSubmit = () => {
    if (!currentTask || !currentWeek) return;
    
    createEntryMutation.mutate({
      taskId: currentTask.id,
      weekNumber: currentWeek,
      completed,
      anxietyLevel: anxietyLevel[0] ?? 5,
      guiltLevel: guiltLevel[0] ?? 5,
      activityDescription: activityDescription.trim() || undefined,
      observationAboutBrian: observationAboutBrian.trim() || undefined,
    });
  };
  
  const handleCloseFeedback = () => {
    setShowFeedback(false);
    setLocation("/");
  };
  
  if (!isAuthenticated) {
    return null;
  }

  // Loading state while fetching current task
  if (!currentTask || !currentWeek) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-safe" />
        <div className="container max-w-lg py-6 space-y-5">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Today's Check-In</h1>
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Safe area padding */}
      <div className="pt-safe" />
      
      <div className="container max-w-lg py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Today's Check-In</h1>
            <p className="text-sm text-muted-foreground">Week {currentWeek}: {currentTask?.taskName}</p>
          </div>
        </div>
        
        {/* Task Description */}
        <Card className="shadow-md bg-primary/5 border-primary/20">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm text-foreground italic">
              "{currentTask?.taskDescription}"
            </p>
          </CardContent>
        </Card>
        
        {/* Check-in Form */}
        <Card className="shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Daily Check-In</CardTitle>
            <CardDescription>Track your progress and feelings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Completion Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div className="space-y-1">
                <Label htmlFor="completed" className="text-base font-medium">
                  Did you complete your task today?
                </Label>
                <p className="text-sm text-muted-foreground">
                  {completed ? "Yes, I did it!" : "Not today"}
                </p>
              </div>
              <Switch
                id="completed"
                checked={completed}
                onCheckedChange={setCompleted}
                className="scale-110"
              />
            </div>
            
            {/* Activity Description */}
            {completed && (
              <div className="space-y-2">
                <Label htmlFor="activity">What did you do?</Label>
                <Textarea
                  id="activity"
                  placeholder="Describe your activity..."
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  rows={3}
                  className="text-base"
                />
              </div>
            )}
            
            {/* Anxiety Level */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>How anxious did you feel?</Label>
                <span className="text-sm font-medium bg-muted px-2 py-1 rounded">{anxietyLevel[0]}/10</span>
              </div>
              <Slider
                value={anxietyLevel}
                onValueChange={setAnxietyLevel}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Calm</span>
                <span>Very anxious</span>
              </div>
            </div>
            
            {/* Guilt Level */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>How guilty did you feel?</Label>
                <span className="text-sm font-medium bg-muted px-2 py-1 rounded">{guiltLevel[0]}/10</span>
              </div>
              <Slider
                value={guiltLevel}
                onValueChange={setGuiltLevel}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>None</span>
                <span>Very guilty</span>
              </div>
            </div>
            
            {/* Observation About Brian */}
            <div className="space-y-2">
              <Label htmlFor="observation">
                What did you notice about Brian? <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="observation"
                placeholder="How did Brian respond or what did you observe..."
                value={observationAboutBrian}
                onChange={(e) => setObservationAboutBrian(e.target.value)}
                rows={3}
                className="text-base"
              />
            </div>
            
            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={createEntryMutation.isPending}
              className="w-full h-12 text-base rounded-xl"
              size="lg"
            >
              {createEntryMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Heart className="mr-2 h-4 w-4" />
                  Save Entry
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Safe area bottom padding */}
      <div className="pb-safe" />
      
      {/* AI Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Check-in Complete
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {feedbackLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                {/* Calming breathing animation */}
                <div className="relative w-32 h-32">
                  {/* Outer breathing ring */}
                  <div 
                    className="absolute inset-0 rounded-full bg-primary/10"
                    style={{
                      animation: 'breathe 4s ease-in-out infinite',
                    }}
                  />
                  {/* Middle ring */}
                  <div 
                    className="absolute inset-4 rounded-full bg-primary/20"
                    style={{
                      animation: 'breathe 4s ease-in-out infinite 0.5s',
                    }}
                  />
                  {/* Inner ring */}
                  <div 
                    className="absolute inset-8 rounded-full bg-primary/30"
                    style={{
                      animation: 'breathe 4s ease-in-out infinite 1s',
                    }}
                  />
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Heart className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-foreground">Take a breath...</p>
                  <p className="text-xs text-muted-foreground">Creating your personalized message</p>
                </div>
                <style>{`
                  @keyframes breathe {
                    0%, 100% { transform: scale(1); opacity: 0.3; }
                    50% { transform: scale(1.15); opacity: 0.6; }
                  }
                `}</style>
              </div>
            ) : (
              <p className="text-foreground leading-relaxed">
                {aiFeedback}
              </p>
            )}
          </div>
          {!feedbackLoading && (
            <Button onClick={handleCloseFeedback} className="w-full h-11 rounded-xl">
              Continue
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
