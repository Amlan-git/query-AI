import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import SearchPage from "./pages/SearchPage";
import AppLayout from "./components/layout/AppLayout";

export function App() {
    useEffect(() => {
        document.documentElement.classList.add("dark");
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/" element={<Home />} />
                <Route
                    path="/search"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <SearchPage />
                            </AppLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/search/:conversationId"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <SearchPage />
                            </AppLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
