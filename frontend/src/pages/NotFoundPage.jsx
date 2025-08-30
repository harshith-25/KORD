import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button'; // Using your Shadcn Button
// import MainLayout from '@/layouts/MainLayout'; // Use MainLayout if it's meant to be within the app layout
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'; // An icon for 404

const NotFoundPage = () => {
	const navigate = useNavigate();

	const handleGoHome = () => {
		navigate('/dashboard'); // Or '/' depending on your app's main entry point after login
	};

	// If you want this page to have the sidebar and header, use MainLayout.
	// If it should be a standalone full-page error (like login/register), remove MainLayout.
	// For a 404, often a standalone page is cleaner. I'll provide both options.

	// Option 1: Standalone 404 page (no sidebar/header, similar to login/register screen)
	return (
		<div className="min-h-screen bg-kord-gradient flex items-center justify-center p-4 text-center text-white">
			<div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg border border-white border-opacity-20 rounded-xl shadow-2xl p-8 sm:p-10 w-full max-w-md animate-fade-in-up">
				<QuestionMarkCircleIcon className="h-24 w-24 mx-auto mb-6 text-indigo-300 drop-shadow-md" />
				<h1 className="text-5xl font-extrabold mb-4 drop-shadow-lg">404</h1>
				<h2 className="text-3xl font-semibold mb-6 text-gray-200">Page Not Found</h2>
				<p className="text-lg mb-8 text-gray-300">
					Oops! The page you're looking for doesn't exist or has been moved.
				</p>
				<Button
					onClick={handleGoHome}
					className="w-full sm:w-auto px-8 py-3 text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
				>
					Go to Dashboard
				</Button>
			</div>
		</div>
	);

	// Option 2: 404 page within the MainLayout (with sidebar/header)
	/*
	return (
		<MainLayout>
			<div className="flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] p-6 text-center bg-app-background text-app-foreground">
				<QuestionMarkCircleIcon className="h-24 w-24 mx-auto mb-6 text-app-accent" />
				<h1 className="text-5xl font-extrabold mb-4">404</h1>
				<h2 className="text-3xl font-semibold mb-6">Page Not Found</h2>
				<p className="text-lg mb-8 text-app-foreground/80">
					Oops! The page you're looking for doesn't exist or has been moved.
				</p>
				<Button
					onClick={handleGoHome}
					className="px-8 py-3 text-lg font-semibold" // Shadcn button default styles apply
				>
					Go to Dashboard
				</Button>
			</div>
		</MainLayout>
	);
	*/
};

export default NotFoundPage;