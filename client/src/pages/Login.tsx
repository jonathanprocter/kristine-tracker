import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Heart, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const [credential, setCredential] = useState("");
  const utils = trpc.useUtils();
  
  const loginMutation = trpc.auth.simpleLogin.useMutation({
    onSuccess: (data) => {
      utils.auth.me.invalidate();
      toast.success(`Welcome, ${data.name}!`);
      // Force a full page reload to ensure auth state is refreshed
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error("Login failed", {
        description: error.message,
      });
    },
  });
  
  const handleLogin = () => {
    if (!credential.trim()) {
      toast.error("Please enter your name or PIN");
      return;
    }
    loginMutation.mutate({ credential: credential.trim() });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Safe area padding for iPhone notch */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-safe pt-safe">
        <div className="w-full max-w-sm mx-auto space-y-8">
          {/* Logo and Title */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Heart className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Kristine's Self-Care Tracker</h1>
              <p className="text-muted-foreground mt-2 text-sm">Supporting you and Brian, one day at a time</p>
            </div>
          </div>
          
          {/* Login Card */}
          <Card className="shadow-lg border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg">Sign In</CardTitle>
              <CardDescription>Enter your name or PIN</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                placeholder="Name or PIN"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-14 text-lg text-center rounded-xl"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
              />
              
              <Button
                onClick={handleLogin}
                disabled={loginMutation.isPending}
                className="w-full h-14 text-lg rounded-xl"
                size="lg"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </CardContent>
          </Card>
          
          {/* Hint */}
          <p className="text-center text-xs text-muted-foreground px-4">
            Kristine: enter your name • Jonathan: enter your PIN
          </p>
        </div>
      </div>
      
      {/* Bottom safe area for iPhone home indicator */}
      <div className="h-safe-bottom" />
    </div>
  );
}
