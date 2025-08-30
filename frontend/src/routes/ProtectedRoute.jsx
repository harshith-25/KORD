import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const ProtectedRoute = () => {
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const isLoading = useAuthStore((state) => state.isLoading); // Assuming you have an isLoading state

	// If still loading auth status, show a spinner
	if (isLoading) {
		return <LoadingSpinner className="min-h-screen" />; // Full page spinner
	}

	// If not authenticated, redirect to login
	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	// If authenticated, render the child routes
	return <Outlet />;
};

export default ProtectedRoute;