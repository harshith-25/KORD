// frontend/src/routes/AppRoutes.jsx

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

// Import your pages
import LoginPage from '@/pages/Auth/LoginPage';
import RegisterPage from '@/pages/Auth/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ChatPage from '@/pages/Chat/ChatPage';
import SettingsPage from '@/pages/Settings/SettingsModal';
import NotFoundPage from '@/pages/NotFoundPage';

// Import the new AppLayout
import AppLayout from '@/layouts/AppLayout';

// AuthGuard to protect routes and provide the AppLayout
const AuthGuard = ({ children }) => {
	const { isAuthenticated, loading, initializeAuth } = useAuthStore();

	useEffect(() => {
		initializeAuth();
	}, [initializeAuth]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center text-gray-700 dark:text-gray-200 text-xl">
				Loading authentication...
			</div>
		);
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return <AppLayout>{children}</AppLayout>;
};

const AppRoutes = () => {
	return (
		<Router
			future={{
				v7_startTransition: true,
				v7_relativeSplatPath: true,
			}}
		>
			<Routes>
				{/* Public Routes */}
				<Route path="/login" element={<LoginPage />} />
				<Route path="/register" element={<RegisterPage />} />

				{/* Protected Routes - wrapped by AuthGuard, which provides AppLayout */}
				<Route
					path="/dashboard"
					element={
						<AuthGuard>
							<DashboardPage />
						</AuthGuard>
					}
				/>
				{/* NEW: Dynamic Chat Route */}
				<Route
					path="/chat/:chatId?" // :chatId is optional, so /chat also works
					element={
						<AuthGuard>
							<ChatPage />
						</AuthGuard>
					}
				/>
				<Route
					path="/settings"
					element={
						<AuthGuard>
							<SettingsPage />
						</AuthGuard>
					}
				/>

				{/* Redirect root to dashboard if authenticated, otherwise to login */}
				<Route
					path="/"
					element={
						<AuthGuard>
							<Navigate to="/dashboard" replace />
						</AuthGuard>
					}
				/>

				{/* 404 Not Found Page */}
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</Router>
	);
};

export default AppRoutes;