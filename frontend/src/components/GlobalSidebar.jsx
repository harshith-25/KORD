import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import SettingsModal from '../pages/Settings/SettingsModal';
import { MessageCircleMore, Phone, Bookmark, Settings, CircleUserRound } from 'lucide-react';

const GlobalSidebar = () => {
	const location = useLocation();
	const logout = useAuthStore((state) => state.logout);

	// Modal states and refs
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
	const [activeSettingsTab, setActiveSettingsTab] = useState('general');
	const settingsButtonRef = useRef(null);

	// Define global navigation items
	const navItems = [
		{ name: 'Chats', icon: MessageCircleMore, path: '/chat' },
		{
			name: 'Call Log',
			icon: Phone,
			action: () => {
				// This would navigate to a call log page or open a modal.
				// For now, it just logs a message.
				console.log('Call log clicked!');
			}
		},
	];

	// Define bottom navigation items
	const bottomNavItems = [
		{ name: 'Starred', icon: Bookmark, path: '/starred' },
		{
			name: 'Settings',
			icon: Settings,
			action: () => {
				// Sets the tab to 'general' before opening the modal
				setActiveSettingsTab('general');
				setIsSettingsModalOpen(true);
			},
			ref: settingsButtonRef
		},
		{
			name: 'Profile',
			icon: CircleUserRound,
			action: () => {
				// Sets the tab to 'profile' before opening the modal
				setActiveSettingsTab('profile');
				setIsSettingsModalOpen(true);
			},
		},
	];

	const renderNavItem = (item, isActive = false) => {
		const baseClasses = `p-2 rounded-lg transition-colors duration-200 ${isActive
			? 'bg-purple-700 text-white shadow-md'
			: 'hover:bg-gray-700 hover:text-white'
			}`;

		if (item.action) {
			return (
				<button
					key={item.name}
					ref={item.ref}
					onClick={item.action}
					className={baseClasses}
					title={item.name}
				>
					<item.icon className="h-6 w-6" strokeWidth={1.8} />
				</button>
			);
		}

		if (item.path) {
			return (
				<Link
					key={item.name}
					to={item.path}
					className={baseClasses}
					title={item.name}
				>
					<item.icon className="h-6 w-6" strokeWidth={1.8} />
				</Link>
			);
		}

		return null;
	};

	return (
		<>
			<aside className="w-16 bg-gray-900 dark:bg-gray-950 text-gray-300 flex flex-col items-center py-4 shadow-lg border-r border-gray-800 dark:border-gray-800">
				<div className="mb-8 mt-2">
					{/* Your logo placeholder */}
				</div>

				<nav className="flex-1 flex flex-col items-center space-y-6">
					{navItems.map((item) => {
						const isActive = item.path && location.pathname.startsWith(item.path);
						return renderNavItem(item, isActive);
					})}
				</nav>

				<div className="flex flex-col items-center space-y-6 mt-auto">
					{bottomNavItems.map((item) => {
						const isActive = item.path && location.pathname === item.path;
						return renderNavItem(item, isActive);
					})}
				</div>
			</aside>

			{/* Settings Modal is rendered here */}
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