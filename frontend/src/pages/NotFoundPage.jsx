import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QuestionMarkCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

const NotFoundPage = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth < 768);
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	const handleGoHome = () => {
		// Navigate to dashboard with replace to prevent back button loop
		navigate('/dashboard', { replace: true });
	};

	const handleGoBack = () => {
		// Check if there's history to go back to
		if (window.history.length > 1) {
			navigate(-1);
		} else {
			// Fallback to dashboard if no history
			handleGoHome();
		}
	};

	// Determine if this is likely a chat route error
	const isChatRoute = location.pathname.startsWith('/chat');

	return (
		<div className="min-h-screen bg-kord-gradient flex items-center justify-center p-4 text-center text-white">
			<div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg border border-white border-opacity-20 rounded-xl shadow-2xl p-8 sm:p-10 w-full max-w-md animate-fade-in-up">
				<QuestionMarkCircleIcon className="h-24 w-24 mx-auto mb-6 text-indigo-300 drop-shadow-md" />
				<h1 className="text-5xl font-extrabold mb-4 drop-shadow-lg">404</h1>
				<h2 className="text-3xl font-semibold mb-6 text-gray-200">
					{isChatRoute ? 'Chat Not Found' : 'Page Not Found'}
				</h2>
				<p className="text-lg mb-8 text-gray-300">
					{isChatRoute
						? "The conversation you're looking for doesn't exist or has been deleted."
						: "Oops! The page you're looking for doesn't exist or has been moved."
					}
				</p>

				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					{isMobile && (
						<Button
							onClick={handleGoBack}
							variant="outline"
							className="w-full sm:w-auto px-6 py-3 text-lg font-semibold bg-white/10 hover:bg-white/20 border-white/30 text-white transition-colors duration-200"
						>
							<ArrowLeftIcon className="h-5 w-5 mr-2 inline" />
							Go Back
						</Button>
					)}
					<Button
						onClick={handleGoHome}
						className="w-full sm:w-auto px-8 py-3 text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
					>
						Go to Dashboard
					</Button>
				</div>
			</div>
		</div>
	);
};

export default NotFoundPage;