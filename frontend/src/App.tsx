import { BrowserRouter, Route, Routes, Navigate } from "react-router";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AuthCallback from "./pages/AuthCallback";
import ProtectedRoute from "./components/ProtectedRoute";
import SearchPage from "./pages/SearchPage";
import AppLayout from "./components/layout/AppLayout";

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/" element={<Navigate to="/search" replace />} />
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

