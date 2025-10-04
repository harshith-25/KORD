import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import SettingsModal from '../pages/Settings/SettingsModal';
import { MessageCircleMore, Phone, Bookmark, Settings, CircleUserRound, Menu, Archive, User } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const GlobalSidebar = () => {
	const location = useLocation();
	const logout = useAuthStore((state) => state.logout);

	// Modal states and refs
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
	const [activeSettingsTab, setActiveSettingsTab] = useState('general');
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const settingsButtonRef = useRef(null);

	// Define global navigation items
	const navItems = [
		{ name: 'Chats', icon: MessageCircleMore, path: '/chat' },
		{ name: 'Status', icon: User, path: '/status' },
		{ name: 'Calls', icon: Phone, path: '/calls' },
	];

	// Define bottom navigation items
	const bottomNavItems = [
		{ name: 'Starred messages', icon: Bookmark, path: '/starred' },
		{ name: 'Archived chats', icon: Archive, path: '/archived' },
		{
			name: 'Settings',
			icon: Settings,
			action: () => {
				setActiveSettingsTab('general');
				setIsSettingsModalOpen(true);
			},
			ref: settingsButtonRef
		},
		{
			name: 'Profile',
			icon: CircleUserRound,
			action: () => {
				setActiveSettingsTab('profile');
				setIsSettingsModalOpen(true);
			},
		},
	];

	const handleNavClick = (item) => {
		if (item.action) {
			item.action();
		}
		setIsSidebarOpen(false);
	};

	const renderCollapsedNavItem = (item, isActive = false) => {
		const baseClasses = `w-12 h-12 rounded-lg transition-colors flex items-center justify-center ${isActive
			? 'bg-[#2a3942] text-white'
			: 'text-[#aebac1] hover:bg-[#2a3942] hover:text-white'
			}`;

		if (item.action) {
			return (
				<Button
					key={item.name}
					ref={item.ref}
					onClick={() => handleNavClick(item)}
					variant="ghost"
					size="icon"
					className={baseClasses}
					title={item.name}
				>
					<item.icon className="h-5 w-5" strokeWidth={1.8} />
				</Button>
			);
		}

		if (item.path) {
			return (
				<Link key={item.name} to={item.path}>
					<Button
						variant="ghost"
						size="icon"
						className={baseClasses}
						title={item.name}
					>
						<item.icon className="h-5 w-5" strokeWidth={1.8} />
					</Button>
				</Link>
			);
		}

		return null;
	};

	return (
		<>
			<Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
				{/* Collapsed Sidebar - Always Visible */}
				<aside className="w-16 bg-[#111b21] flex flex-col items-center py-3 border-r border-[#2a3942]">
					{/* Menu/Hamburger Toggle */}
					<SheetTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="w-12 h-12 mb-4 text-[#aebac1] hover:bg-[#2a3942] hover:text-white rounded-lg flex items-center justify-center"
						>
							<Menu className="h-5 w-5" strokeWidth={1.8} />
						</Button>
					</SheetTrigger>

					{/* Top Navigation */}
					<nav className="flex-1 flex flex-col items-center space-y-1 w-full px-2">
						{navItems.map((item) => {
							const isActive = item.path && location.pathname.startsWith(item.path);
							return renderCollapsedNavItem(item, isActive);
						})}

						{/* Meta AI Icon */}
						<Button
							variant="ghost"
							size="icon"
							className="w-12 h-12 rounded-lg transition-colors text-[#aebac1] hover:bg-[#2a3942] hover:text-white flex items-center justify-center"
							title="Meta AI"
						>
							<div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
								<MessageCircleMore className="h-4 w-4 text-white" strokeWidth={2} />
							</div>
						</Button>
					</nav>

					{/* Bottom Navigation */}
					<div className="flex flex-col items-center space-y-1 w-full px-2 mt-auto">
						{bottomNavItems.map((item) => {
							const isActive = item.path && location.pathname === item.path;
							return renderCollapsedNavItem(item, isActive);
						})}
					</div>
				</aside>

				{/* Expanded Sidebar - Sheet Overlay */}
				<SheetContent
					side="left"
					className="w-64 p-0 bg-[#111b21] border-r border-[#2a3942] ml-16"
				>
					<div className="flex flex-col h-full">
						{/* Header with Menu Toggle */}
						<div className="bg-[#111b21] px-4 py-4 flex items-center">
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setIsSidebarOpen(false)}
								className="w-9 h-9 text-[#aebac1] hover:bg-[#2a3942] hover:text-white rounded-lg flex items-center justify-center"
							>
								<Menu className="h-5 w-5" strokeWidth={1.8} />
							</Button>
						</div>

						{/* Navigation Items */}
						<div className="flex-1 flex flex-col bg-[#111b21]">
							{/* Top Navigation */}
							<div className="flex-1">
								{navItems.map((item) => {
									const isActive = item.path && location.pathname.startsWith(item.path);
									return (
										<Link
											key={item.name}
											to={item.path}
											onClick={() => setIsSidebarOpen(false)}
											className={`w-full flex items-center gap-8 px-6 py-3 transition-colors ${isActive
												? 'bg-[#2a3942] text-white'
												: 'text-[#aebac1] hover:bg-[#202c33]'
												}`}
										>
											<item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.8} />
											<span className="text-[15px]">{item.name}</span>
										</Link>
									);
								})}

								{/* Meta AI */}
								<button
									className="w-full flex items-center gap-8 px-6 py-3 transition-colors text-[#aebac1] hover:bg-[#202c33]"
								>
									<div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
										<MessageCircleMore className="h-3 w-3 text-white" strokeWidth={2} />
									</div>
									<span className="text-[15px]">Meta AI</span>
								</button>
							</div>

							{/* Bottom Section */}
							<div className="border-t border-[#2a3942] bg-[#111b21]">
								{bottomNavItems.map((item) => {
									const isActive = item.path && location.pathname === item.path;
									if (item.action) {
										return (
											<button
												key={item.name}
												ref={item.ref}
												onClick={() => handleNavClick(item)}
												className={`w-full flex items-center gap-8 px-6 py-3 transition-colors ${isActive
													? 'bg-[#2a3942] text-white'
													: 'text-[#aebac1] hover:bg-[#202c33]'
													}`}
											>
												<item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.8} />
												<span className="text-[15px]">{item.name}</span>
											</button>
										);
									}

									return (
										<Link
											key={item.name}
											to={item.path}
											onClick={() => setIsSidebarOpen(false)}
											className={`w-full flex items-center gap-8 px-6 py-3 transition-colors ${isActive
												? 'bg-[#2a3942] text-white'
												: 'text-[#aebac1] hover:bg-[#202c33]'
												}`}
										>
											<item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.8} />
											<span className="text-[15px]">{item.name}</span>
										</Link>
									);
								})}
							</div>
						</div>
					</div>
				</SheetContent>
			</Sheet>

			{/* Settings Modal */}
			<SettingsModal
				isOpen={isSettingsModalOpen}
				onClose={() => setIsSettingsModalOpen(false)}
				anchorRef={settingsButtonRef}
				tab={activeSettingsTab}
			/>
		</>
	);
};

export default GlobalSidebar;