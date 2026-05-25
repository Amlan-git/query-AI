import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { supabase } from "@/lib/supabase";

export default function ProtectedRoute({ 
    children 
}: { 
    children: React.ReactNode 
}) {
    const [user, setUser] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setUser(data.user);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 
                     border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    return <>{children}</>;
}
