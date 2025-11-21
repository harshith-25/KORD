import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import SettingsModal from '../pages/Settings/SettingsModal';
import { MessageCircleMore, Phone, Bookmark, Settings, CircleUserRound, Menu, Archive, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import reactLogo from '@/assets/react.svg';

const GlobalSidebar = ({ isMobile, onItemClick }) => {
	const location = useLocation();
	const logout = useAuthStore((state) => state.logout);

	// Modal states and refs
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
	const [activeSettingsTab, setActiveSettingsTab] = useState('general');
	const [isExpanded, setIsExpanded] = useState(false);
	const settingsButtonRef = useRef(null);
	const sidebarRef = useRef(null);

	// Close sidebar when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (isExpanded && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
				setIsExpanded(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isExpanded]);

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
		if (onItemClick) onItemClick();
	};

	const renderNavItem = (item, isActive) => {
		// Mobile View
		if (isMobile) {
			const baseClasses = `w-full flex items-center gap-4 px-3 py-2 rounded-lg transition-colors ${isActive
				? 'bg-[#2a3942] text-white'
				: 'text-[#aebac1] hover:bg-[#202c33] hover:text-white'
				}`;

			const content = (
				<>
					<item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.8} />
					<span className="text-[15px] font-medium">{item.name}</span>
				</>
			);

			if (item.action) {
				return (
					<button
						key={item.name}
						ref={item.ref}
						onClick={() => handleNavClick(item)}
						className={baseClasses}
					>
						{content}
					</button>
				);
			}

			return (
				<Link
					key={item.name}
					to={item.path}
					onClick={() => handleNavClick(item)}
					className={baseClasses}
				>
					{content}
				</Link>
			);
		}

		// Desktop View
		const baseClasses = `flex items-center h-12 rounded-lg transition-colors relative overflow-hidden group ${isActive
			? 'bg-[#2a3942] text-white'
			: 'text-[#aebac1] hover:bg-[#2a3942] hover:text-white'
			}`;

		const content = (
			<>
				{/* Icon Container - Always fixed width and centered */}
				<div className="min-w-[48px] h-12 flex items-center justify-center">
					<item.icon className="h-5 w-5" strokeWidth={1.8} />
				</div>

				{/* Text Container - Transitions opacity and visibility */}
				<div className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 w-auto translate-x-0' : 'opacity-0 w-0 -translate-x-4'
					}`}>
					<span className="text-[15px] font-medium pl-1">{item.name}</span>
				</div>
			</>
		);

		if (item.action) {
			return (
				<button
					key={item.name}
					ref={item.ref}
					onClick={() => handleNavClick(item)}
					className={`${baseClasses} w-full`}
					title={!isExpanded ? item.name : ''}
				>
					{content}
				</button>
			);
		}

		return (
			<Link
				key={item.name}
				to={item.path}
				className={`${baseClasses} w-full`}
				title={!isExpanded ? item.name : ''}
			>
				{content}
			</Link>
		);
	};

	// Mobile View (List for Dropdown)
	if (isMobile) {
		return (
			<>
				<div className="flex flex-col gap-1 py-1">
					{navItems.map((item) => {
						const isActive = item.path && location.pathname.startsWith(item.path);
						return renderNavItem(item, isActive);
					})}

					{/* Meta AI */}
					<button
						className="w-full flex items-center gap-4 px-3 py-2 rounded-lg transition-colors text-[#aebac1] hover:bg-[#202c33] hover:text-white"
					>
						<div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
							<MessageCircleMore className="h-3 w-3 text-white" strokeWidth={2} />
						</div>
						<span className="text-[15px] font-medium">Meta AI</span>
					</button>
				</div>

				<div className="my-2 border-t border-[#2a3942]" />

				<div className="flex flex-col gap-1 py-1">
					{bottomNavItems.map((item) => {
						const isActive = item.path && location.pathname === item.path;
						return renderNavItem(item, isActive);
					})}
				</div>

				{/* Settings Modal */}
				<SettingsModal
					isOpen={isSettingsModalOpen}
					onClose={() => setIsSettingsModalOpen(false)}
					anchorRef={settingsButtonRef}
					tab={activeSettingsTab}
				/>
			</>
		);
	}

	// Desktop View (Collapsible Sidebar)
	return (
		<>
			<aside
				ref={sidebarRef}
				className={`fixed top-0 left-0 h-full bg-[#111b21] border-r border-[#2a3942] z-50 flex flex-col transition-all duration-300 ease-in-out ${isExpanded ? 'w-[230px]' : 'w-[65px]'
					}`}
			>
				{/* Header / Toggle */}
				<div className="flex items-center h-16 px-2 gap-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsExpanded(!isExpanded)}
						className="w-12 h-12 text-[#aebac1] hover:bg-[#2a3942] hover:text-white rounded-lg flex items-center justify-center flex-shrink-0"
					>
						<Menu className="h-5 w-5" strokeWidth={1.8} />
					</Button>

					{/* Logo and Company Name - Only visible when expanded */}
					{isExpanded && (
						<div className="flex items-center ml-3 gap-2 overflow-hidden">
							<img src={reactLogo} alt="KORD Logo" className="w-8 h-8" />
							<span className="text-white font-semibold text-lg whitespace-nowrap">KORD</span>
						</div>
					)}
				</div>

				{/* Top Navigation */}
				<nav className="flex-1 flex flex-col gap-2 px-1.5 mt-2">
					{navItems.map((item) => {
						const isActive = item.path && location.pathname.startsWith(item.path);
						return renderNavItem(item, isActive);
					})}

					{/* Meta AI */}
					<button
						className={`flex items-center h-12 rounded-lg transition-colors relative overflow-hidden group w-full text-[#aebac1] hover:bg-[#2a3942] hover:text-white`}
						title={!isExpanded ? "Meta AI" : ''}
					>
						<div className="min-w-[48px] h-12 flex items-center justify-center">
							<div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
								<MessageCircleMore className="h-3.5 w-3.5 text-white" strokeWidth={2} />
							</div>
						</div>
						<div className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 w-auto translate-x-0' : 'opacity-0 w-0 -translate-x-4'
							}`}>
							<span className="text-[15px] font-medium pl-1">Meta AI</span>
						</div>
					</button>
				</nav>

				{/* Bottom Navigation */}
				<div className="flex flex-col gap-2 px-1.5 mb-4">
					{bottomNavItems.map((item) => {
						const isActive = item.path && location.pathname === item.path;
						return renderNavItem(item, isActive);
					})}
				</div>
			</aside>

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