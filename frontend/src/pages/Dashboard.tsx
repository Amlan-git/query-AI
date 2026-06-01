import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { type User } from "@supabase/supabase-js";
import { Activity, LogIn, LogOut, Mail, Shield, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getInfo() {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Error retrieving user info:", err);
      } finally {
        setLoading(false);
      }
    }
    getInfo();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 md:p-12 relative z-10">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Query Hub
        </h1>
        <p className="text-muted-foreground text-base">
          Manage your AI research sessions, databases, and profile settings.
        </p>
      </div>

      {!user ? (
        <Card className="border-dashed bg-card/50 backdrop-blur-md transition-all duration-300 hover:shadow-lg dark:bg-card/20">
          <CardHeader className="text-center py-10 gap-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Shield className="size-7" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Access Restricted</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Please sign in to access your customized AI search sessions, historical telemetry, and integration dashboards.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pb-10">
            <Button onClick={() => navigate("/auth")} className="gap-2 px-8 py-5 text-base font-semibold shadow-md transition-transform hover:scale-102">
              <LogIn className="size-5" />
              Sign In to Your Account
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Profile Info */}
          <Card className="md:col-span-2 bg-gradient-to-b from-card/85 to-card border shadow-sm backdrop-blur-md">
            <CardHeader className="border-b pb-6 gap-2">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">User Profile</CardTitle>
                  <CardDescription>Details synced from Supabase Authentication</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unique Identifier</span>
                <code className="text-sm rounded bg-muted/60 dark:bg-muted/30 px-3 py-2 font-mono border text-foreground/80 overflow-x-auto">
                  {user.id}
                </code>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</span>
                <div className="flex items-center gap-2.5 text-foreground/85 px-3 py-2 rounded bg-muted/30 dark:bg-muted/15 border border-transparent">
                  <Mail className="size-4.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{user.email}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auth Provider</span>
                <span className="inline-flex w-fit items-center rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20 capitalize">
                  {user.app_metadata.provider || "Email/Password"}
                </span>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6 justify-between flex-wrap gap-4">
              <p className="text-xs text-muted-foreground">Signed in: {new Date(user.created_at).toLocaleDateString()}</p>
              <Button onClick={handleLogout} variant="destructive" className="gap-2 font-medium shadow-xs">
                <LogOut className="size-4" />
                Sign Out
              </Button>
            </CardFooter>
          </Card>

          {/* Quick Telemetry Info */}
          <Card className="bg-card/50 backdrop-blur-md border shadow-sm">
            <CardHeader className="gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10 text-purple-600">
                <Activity className="size-5.5" />
              </div>
              <CardTitle className="text-lg font-bold">Workspace Stats</CardTitle>
              <CardDescription>Telemetry from current session</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm pt-2">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Connection Status</span>
                <span className="font-semibold text-emerald-500">Live</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Search Indexes</span>
                <span className="font-semibold text-foreground">Advanced (Tavily)</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-foreground">Database Sync</span>
                <span className="font-semibold text-foreground">Active (Supabase)</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
