import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Plus, TrendingDown } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Accommodations() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: currentWeek } = trpc.user.getCurrentWeek.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const { data: accommodations } = trpc.accommodations.getByUser.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const [timeOfDay, setTimeOfDay] = useState("");
  const [whatDid, setWhatDid] = useState("");
  const [couldHeDoIt, setCouldHeDoIt] = useState<"yes" | "no" | "maybe">("yes");
  const [whatFelt, setWhatFelt] = useState("");
  
  const createAccommodationMutation = trpc.accommodations.create.useMutation({
    onSuccess: () => {
      utils.accommodations.invalidate();
      
      toast.success("Accommodation logged", {
        description: "Building awareness is the first step.",
      });
      
      // Reset form
      setTimeOfDay("");
      setWhatDid("");
      setCouldHeDoIt("yes");
      setWhatFelt("");
    },
    onError: (error) => {
      toast.error("Failed to log accommodation", {
        description: error.message,
      });
    },
  });
  
  const handleSubmit = () => {
    if (!timeOfDay || !whatDid || !whatFelt) {
      toast.error("Please fill in all fields");
      return;
    }
    
    createAccommodationMutation.mutate({
      loggedAt: new Date(),
      timeOfDay,
      whatDid,
      couldHeDoIt,
      whatFelt,
    });
  };
  
  if (!isAuthenticated) {
    return null;
  }
  
  // Only show for weeks 1-2
  if (currentWeek && currentWeek > 2) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl py-8 space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Accommodation Log</h1>
          </div>
          
          <Card className="shadow-md">
            <CardContent className="pt-6 text-center space-y-4">
              <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">
                The accommodation log is only for Weeks 1-2. You're now in Week {currentWeek} and focusing on different tasks.
              </p>
              <Button onClick={() => setLocation("/")}>Return Home</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  const todayAccommodations = accommodations?.filter(a => {
    const loggedDate = new Date(a.loggedAt);
    const today = new Date();
    return loggedDate.toDateString() === today.toDateString();
  }) ?? [];
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Accommodation Log</h1>
            <p className="text-sm text-muted-foreground">Week {currentWeek} - Building Awareness</p>
          </div>
        </div>
        
        {/* Info Card */}
        <Card className="shadow-md bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm text-foreground">
              An <strong>accommodation</strong> is doing something FOR Brian that he could do himself. 
              Log every accommodation throughout the day to build awareness of patterns.
            </p>
          </CardContent>
        </Card>
        
        {/* Add Accommodation Form */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Log an Accommodation</CardTitle>
            <CardDescription>Track when and how you accommodate Brian</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="time">What time?</Label>
              <Input
                id="time"
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="what">What did you do FOR Brian?</Label>
              <Textarea
                id="what"
                placeholder="e.g., Brought him lunch, Asked 'are you okay?', Made his dinner..."
                value={whatDid}
                onChange={(e) => setWhatDid(e.target.value)}
                rows={2}
              />
            </div>
            
            <div className="space-y-3">
              <Label>Could he have done it himself?</Label>
              <RadioGroup value={couldHeDoIt} onValueChange={(v) => setCouldHeDoIt(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="yes" />
                  <Label htmlFor="yes" className="font-normal cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="no" />
                  <Label htmlFor="no" className="font-normal cursor-pointer">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="maybe" id="maybe" />
                  <Label htmlFor="maybe" className="font-normal cursor-pointer">Maybe</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="felt">What were you feeling?</Label>
              <Textarea
                id="felt"
                placeholder="e.g., Anxious he'd be hungry, Guilty if I didn't, Worried about his symptoms..."
                value={whatFelt}
                onChange={(e) => setWhatFelt(e.target.value)}
                rows={2}
              />
            </div>
            
            <Button onClick={handleSubmit} className="w-full" size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </CardContent>
        </Card>
        
        {/* Today's Log */}
        {todayAccommodations.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Today's Log ({todayAccommodations.length} entries)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayAccommodations.map((acc) => (
                <div key={acc.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{acc.timeOfDay}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      acc.couldHeDoIt === 'yes' 
                        ? 'bg-destructive/10 text-destructive' 
                        : acc.couldHeDoIt === 'no'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-secondary/10 text-secondary'
                    }`}>
                      Could he do it? {acc.couldHeDoIt}
                    </span>
                  </div>
                  <p className="text-sm">{acc.whatDid}</p>
                  <p className="text-xs text-muted-foreground italic">{acc.whatFelt}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        
        {/* Supportive Message */}
        <Card className="shadow-md bg-secondary/10 border-secondary/30">
          <CardContent className="pt-6">
            <p className="text-sm text-center italic text-foreground">
              "Logging accommodations builds awareness. You're not failing when you accommodate—you're learning your patterns."
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
