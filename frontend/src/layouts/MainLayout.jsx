// import ThemeToggle from '@/components/ui/ThemeToggle';
// import { useAuthStore } from '@/store/authStore';

// const MainLayout = ({ children }) => {
// 	const logout = useAuthStore((state) => state.logout);

// 	const handleLogout = () => {
// 		logout();
// 		window.location.href = '/login';
// 	};

// 	return (
// 		// Apply theme-aware background and text colors using our custom utility classes
// 		<div className="flex min-h-screen bg-app-background text-app-foreground">
// 			{/* Example: A simple sidebar */}
// 			<aside className="w-64 bg-app-secondary p-4 shadow-lg flex flex-col">
// 				<div className="flex-grow">
// 					<h2 className="text-2xl font-bold text-app-foreground mb-6">Kord</h2>
// 					<nav>
// 						<ul>
// 							<li className="mb-3">
// 								<a href="/dashboard" className="block p-2 rounded text-app-foreground hover:bg-app-primary hover:text-app-primary-foreground transition-colors duration-200">
// 									Dashboard
// 								</a>
// 							</li>
// 							<li className="mb-3">
// 								<a href="/chat" className="block p-2 rounded text-app-foreground hover:bg-app-primary hover:text-app-primary-foreground transition-colors duration-200">
// 									Chat
// 								</a>
// 							</li>
// 							<li className="mb-3">
// 								<a href="/settings" className="block p-2 rounded text-app-foreground hover:bg-app-primary hover:text-app-primary-foreground transition-colors duration-200">
// 									Settings
// 								</a>
// 							</li>
// 						</ul>
// 					</nav>
// 				</div>
// 				{/* Theme Toggle and Logout at the bottom of sidebar */}
// 				<div className="mt-auto pt-4 border-t border-app-border flex justify-between items-center">
// 					<ThemeToggle />
// 					<button
// 						onClick={handleLogout}
// 						// Using explicit colors for logout button, or define a destructive-themed class
// 						className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
// 					>
// 						Logout
// 					</button>
// 				</div>
// 			</aside>

// 			{/* Main content area */}
// 			<main className="flex-1 p-6 overflow-auto">
// 				{children}
// 			</main>
// 		</div>
// 	);
// };

// export default MainLayout;