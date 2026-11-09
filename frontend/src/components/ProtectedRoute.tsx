import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { supabase } from "@/lib/supabase";
import { checkProtectedAccess, type AccessState } from "@/lib/auth-flow";

export default function ProtectedRoute({ 
    children 
}: { 
    children: React.ReactNode 
}) {
    const [access, setAccess] = useState<AccessState>({ status: "loading" });
    const [attempt, setAttempt] = useState(0);
    const location = useLocation();

    useEffect(() => {
        let active = true;
        void checkProtectedAccess(supabase.auth).then(result => {
            if (active) setAccess(result);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT") {
                active = false;
                setAccess({ status: "signed-out" });
            }
        });
        return () => { active = false; subscription.unsubscribe(); };
    }, [attempt]);

    if (access.status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 
                     border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (access.status === "error") {
        return (
            <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
                <p>We couldn’t check your sign-in right now. Please try again.</p>
                <button type="button" className="rounded-lg border px-4 py-2" onClick={() => {
                    setAccess({ status: "loading" });
                    setAttempt(value => value + 1);
                }}>Try again</button>
            </div>
        );
    }

    if (access.status === "signed-out") {
        return <Navigate to={`/auth${location.search}`} replace />;
    }

    return <>{children}</>;
}
