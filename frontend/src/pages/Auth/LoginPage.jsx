// frontend/src/pages/Auth/LoginPage.jsx

import { useState } from 'react';
// Import Lucide icons
import { Eye, EyeOff, Mail, Lock, Sparkles, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import { useAuthStore } from '@/store/authStore'; // Import your actual auth store

const LoginPage = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);

	// Get login function and loading/error state from your authStore
	const { login, loading, error: authError, setLoading, setError } = useAuthStore();
	const navigate = useNavigate(); // Initialize navigate hook

	// This internal error state is for client-side validation messages only
	const [localError, setLocalError] = useState('');

	const handleSubmit = async (e) => {
		if (e) e.preventDefault(); // Prevent default form submission if triggered by form
		setLocalError(''); // Clear previous local errors

		// Client-side validation
		if (!email.trim() || !password.trim()) {
			setLocalError('Email and password are required.');
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			setLocalError('Please enter a valid email address.');
			return;
		}

		setLoading(true); // Set loading true through Zustand store
		setError(null); // Clear any existing authStore error

		try {
			await login(email, password);
			navigate('/dashboard'); // Navigate on successful login
		} catch (err) {
			// The error message is already set in authStore and re-thrown
			// We just need to ensure our UI displays it (authError will now contain it)
			console.error("Login attempt failed:", err);
			// No need to set setError(err.message) here again as it's done in authStore
		} finally {
			setLoading(false); // Set loading false through Zustand store
		}
	};

	const handleKeyPress = (e) => {
		if (e.key === 'Enter') {
			handleSubmit();
		}
	};

	// Decide which error to display: local validation error or backend/authStore error
	const displayError = localError || authError;

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
			{/* Super attractive small flashy card */}
			<div className="relative group">
				{/* Animated rainbow border */}
				<div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-2xl blur-sm opacity-75 group-hover:opacity-100 animate-pulse"></div>

				{/* Main card */}
				<div className="relative bg-white rounded-xl shadow-2xl p-6 w-80 transform transition-all duration-300 hover:scale-105">
					{/* Glowing top accent */}
					<div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
						<div className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-full p-3 shadow-lg animate-bounce">
							<Zap className="w-6 h-6 text-white" />
						</div>
					</div>

					{/* Header */}
					<div className="text-center mt-4 mb-6">
						<h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">
							Kord
						</h1>
						<p className="text-gray-600 text-sm">Welcome back!</p>
					</div>

					{/* Form inputs */}
					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Email Input */}
						<div className="relative">
							<div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-300 ${email ? 'text-purple-500' : 'text-gray-400'}`}>
								<Mail className="h-4 w-4" />
							</div>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder="Email address"
								className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-purple-500 transition-all duration-300 hover:border-purple-300"
								autoComplete="email"
								required
							/>
						</div>

						{/* Password Input */}
						<div className="relative">
							<div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-300 ${password ? 'text-purple-500' : 'text-gray-400'}`}>
								<Lock className="h-4 w-4" />
							</div>
							<input
								type={showPassword ? 'text' : 'password'}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder="Password"
								className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-purple-500 transition-all duration-300 hover:border-purple-300"
								autoComplete="current-password"
								required
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-500 transition-all duration-300 transform hover:scale-110"
								aria-label={showPassword ? 'Hide password' : 'Show password'}
							>
								{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
						</div>

						{/* Error Message */}
						{displayError && (
							<div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm animate-pulse">
								<div className="flex items-center">
									<div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-ping"></div>
									{displayError}
								</div>
							</div>
						)}

						{/* Submit Button */}
						<button
							type="submit" // Changed to type="submit" to link with form
							disabled={loading}
							className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden"
						>
							{/* Shimmer effect */}
							<div className="absolute inset-0 -top-2 bg-gradient-to-r from-transparent via-white/20 to-transparent transform skew-x-12 -translate-x-full group-hover:animate-pulse"></div>

							{loading ? (
								<>
									<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
									Signing in...
								</>
							) : (
								<>
									Sign In
									<ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
								</>
							)}
						</button>
					</form>

					{/* Divider */}
					<div className="flex items-center my-4">
						<div className="flex-1 border-t border-gray-200"></div>
						<span className="px-3 text-gray-500 text-xs">or</span>
						<div className="flex-1 border-t border-gray-200"></div>
					</div>

					{/* Social Login */}
					<div className="grid grid-cols-2 gap-2">
						<button className="flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-purple-300 transition-all duration-300 transform hover:scale-105">
							<svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
								<path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
								<path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
								<path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
								<path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
							</svg>
							<span className="text-xs">Google</span>
						</button>
						<button className="flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-purple-300 transition-all duration-300 transform hover:scale-105">
							<svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
								<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
							</svg>
							<span className="text-xs">Facebook</span>
						</button>
					</div>

					{/* Register Link */}
					<div className="text-center mt-4">
						<p className="text-gray-600 text-xs">
							Don't have an account?{' '}
							<a
								href="/register"
								className="text-purple-600 hover:text-purple-700 font-medium transition-colors duration-300 hover:underline"
								onClick={(e) => {
									e.preventDefault();
									navigate('/register');
								}}
							>
								Register
							</a>
						</p>
					</div>

					{/* Floating particles effect */}
					<div className="absolute top-4 right-4 w-1 h-1 bg-purple-400 rounded-full animate-ping"></div>
					<div className="absolute bottom-4 left-4 w-1 h-1 bg-pink-400 rounded-full animate-ping delay-1000"></div>
					<div className="absolute top-1/2 right-2 w-0.5 h-0.5 bg-blue-400 rounded-full animate-pulse delay-500"></div>
				</div>
			</div>
		</div>
	);
};

export default LoginPage;