import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  PenLine, 
  Sparkles, 
  Loader2, 
  BookOpen,
  Trash2,
  Heart
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Journal() {
  const { user, loading: authLoading } = useAuth();
  const [content, setContent] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const [showAiResponse, setShowAiResponse] = useState<string | null>(null);
  
  const utils = trpc.useUtils();
  
  const { data: entries, isLoading: entriesLoading } = trpc.journal.getAll.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  const createMutation = trpc.journal.create.useMutation({
    onSuccess: (data) => {
      setContent("");
      setIsWriting(false);
      setShowAiResponse(data.aiResponse || null);
      utils.journal.getAll.invalidate();
      toast.success("Journal entry saved");
    },
    onError: () => {
      toast.error("Failed to save entry");
    },
  });
  
  const deleteMutation = trpc.journal.delete.useMutation({
    onSuccess: () => {
      utils.journal.getAll.invalidate();
      toast.success("Entry deleted");
    },
    onError: () => {
      toast.error("Failed to delete entry");
    },
  });
  
  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error("Please write something first");
      return;
    }
    createMutation.mutate({ content: content.trim() });
  };
  
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p>Please log in to access your journal.</p>
            <Link href="/login">
              <Button className="mt-4">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border pt-safe-top">
        <div className="container py-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-foreground">My Journal</h1>
              <p className="text-sm text-muted-foreground">Write freely, receive support</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container py-6 space-y-6">
        {/* AI Response Dialog */}
        {showAiResponse && (
          <Card className="bg-secondary/30 border-secondary">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-secondary">
                  <Sparkles className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-secondary-foreground mb-1">
                    A gentle thought for you
                  </p>
                  <p className="text-foreground leading-relaxed">{showAiResponse}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setShowAiResponse(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Write New Entry */}
        {isWriting ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PenLine className="h-5 w-5 text-primary" />
                What's on your mind?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Write whatever you're feeling... There's no right or wrong here."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[150px] text-base resize-none"
                autoFocus
              />
              
              {/* Generating animation */}
              {createMutation.isPending && (
                <div className="flex flex-col items-center justify-center py-6 space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-2 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
                    <div className="absolute inset-4 rounded-full bg-primary/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.6s' }} />
                    <div className="relative w-16 h-16 rounded-full bg-primary/50 flex items-center justify-center">
                      <Heart className="h-6 w-6 text-primary-foreground animate-pulse" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    Reading your thoughts with care...
                  </p>
                </div>
              )}
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsWriting(false);
                    setContent("");
                  }}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !content.trim()}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Entry"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button
            className="w-full h-14 text-base bg-primary hover:bg-primary/90"
            onClick={() => setIsWriting(true)}
          >
            <PenLine className="h-5 w-5 mr-2" />
            Write a New Entry
          </Button>
        )}
        
        {/* Past Entries */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Your Entries
          </h2>
          
          {entriesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-4">
              {entries.map((entry) => (
                <Card key={entry.id} className="overflow-hidden">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.createdAt), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                      </p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ id: entry.id })}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    
                    <p className="text-foreground whitespace-pre-wrap mb-4">{entry.content}</p>
                    
                    {entry.aiResponse && (
                      <div className="bg-secondary/20 rounded-lg p-4 border-l-4 border-secondary">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-secondary-foreground" />
                          <span className="text-xs font-medium text-secondary-foreground">Response</span>
                        </div>
                        <p className="text-sm text-foreground/80 italic">{entry.aiResponse}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-muted/30">
              <CardContent className="py-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Your journal is empty. Start writing to receive personalized support.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
