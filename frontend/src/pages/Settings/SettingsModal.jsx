import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/utils/axiosInstance';
import { GET_USER_PROFILE_ROUTE } from '@/utils/ApiRoutes';
import {
	User, MessageCircle, Bell, Settings, LogOut, Info,
	Loader2, XCircle, ChevronLeft
} from 'lucide-react';

// Dynamically import the settings panels
const ProfileSettings = lazy(() => import('./ProfileSettings'));
const GeneralSettings = lazy(() => import('./GeneralSettings'));
const ChatsSettings = lazy(() => import('./ChatsSettings'));
const NotificationsSettings = lazy(() => import('./NotificationsSettings'));
const AboutSettings = lazy(() => import('./AboutSettings'));

// Custom Hook for Theme Management
const useTheme = () => {
	const [theme, setTheme] = useState(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem('theme') || 'light';
		}
		return 'light';
	});

	useEffect(() => {
		const root = document.documentElement;
		if (theme === 'dark') {
			root.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		} else {
			root.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}
	}, [theme]);

	const toggleTheme = () => {
		setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
	};

	return { theme, toggleTheme };
};

// Reusable UI Component
const SettingsButton = ({ icon: Icon, label, onClick, className = '', isActive = false }) => (
	<button
		onClick={onClick}
		className={`flex items-center px-4 py-3 rounded-none text-left w-full transition-all duration-200 ease-in-out
                hover:bg-gray-100 dark:hover:bg-gray-700
                ${isActive ? 'bg-gray-100 dark:bg-gray-700 border-r-4 border-green-500' : ''}
                ${className}`}
	>
		{Icon && <Icon className="mr-3 h-5 w-5 text-gray-600 dark:text-gray-300" />}
		<span className="font-normal text-gray-800 dark:text-gray-200">{label}</span>
	</button>
);

const SettingsModal = ({ isOpen, onClose, anchorRef, tab='general' }) => {
	const { user, loading, error, logout, setLoading, setError, set } = useAuthStore();
	const { theme, toggleTheme } = useTheme();
	const [activeTab, setActiveTab] = useState(tab);
	const [showAnimation, setShowAnimation] = useState(false);
	const modalRef = useRef(null);

	const updateAuthStoreUser = (updatedUserData) => {
		set({ user: updatedUserData });
	};

	useEffect(() => {
		if (isOpen) {
			setShowAnimation(true);
			if (!user || !user._id) {
				fetchUserProfile();
			}
		} else {
			setShowAnimation(false);
			setActiveTab('general');
		}
	}, [isOpen, user]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (modalRef.current && !modalRef.current.contains(event.target) &&
				anchorRef?.current && !anchorRef.current.contains(event.target)) {
				onClose();
			}
		};
		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [isOpen, onClose, anchorRef]);

	useEffect(() => {
		const handleEscKey = (event) => {
			if (event.key === 'Escape' && isOpen) {
				onClose();
			}
		};
		document.addEventListener('keydown', handleEscKey);
		return () => document.removeEventListener('keydown', handleEscKey);
	}, [isOpen, onClose]);

	const fetchUserProfile = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await api.get(GET_USER_PROFILE_ROUTE);
			updateAuthStoreUser(response.data.user);
		} catch (err) {
			const msg = err.response?.data?.message || 'Failed to fetch user profile.';
			setError(msg);
			console.error("Error fetching user profile:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleLogout = () => {
		logout();
		onClose();
	};

	const renderContent = () => {
		if (loading) {
			return (
				<div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
					<Loader2 className="w-8 h-8 animate-spin mr-2" /> Loading settings...
				</div>
			);
		}
		if (error) {
			return (
				<div className="flex items-center justify-center h-full text-red-500 dark:text-red-400 p-4 text-center">
					<XCircle className="w-6 h-6 mr-2" /> Error: {error}
				</div>
			);
		}

		return (
			<Suspense fallback={
				<div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
					<Loader2 className="w-8 h-8 animate-spin mr-2" /> Loading tab content...
				</div>
			}>
				{
					{
						'profile': <ProfileSettings user={user} updateAuthStoreUser={updateAuthStoreUser} setLoading={setLoading} setError={setError} />,
						'general': <GeneralSettings toggleTheme={toggleTheme} theme={theme} />,
						'chats': <ChatsSettings />,
						'notifications': <NotificationsSettings />,
						'about': <AboutSettings />,
					}[activeTab]
				}
			</Suspense>
		);
	};

	if (!isOpen) return null;

	return (
		<div
			ref={modalRef}
			className={`fixed z-50 transition-all duration-200 ease-out ${showAnimation
				? 'opacity-100 translate-y-0'
				: 'opacity-0 translate-y-full'
				}`}
			style={{
				bottom: '0.3rem',
				left: '0.3rem',
				width: '600px',
				height: '600px'
			}}
		>
			<div className="flex h-full bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
				<div className="w-48 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
					<div className="bg-green-600 dark:bg-green-700 px-6 py-4 flex items-center">
						<button
							onClick={onClose}
							className="mr-4 p-1 text-white hover:bg-green-700 dark:hover:bg-green-800 rounded transition-colors"
						>
							<ChevronLeft className="h-6 w-6" />
						</button>
						<h2 className="text-xl font-medium text-white">Settings</h2>
					</div>
					<nav className="flex-1 py-2 overflow-y-auto">
						<SettingsButton
							icon={User}
							label="Profile"
							onClick={() => setActiveTab('profile')}
							isActive={activeTab === 'profile'}
						/>
						<SettingsButton
							icon={Settings}
							label="General"
							onClick={() => setActiveTab('general')}
							isActive={activeTab === 'general'}
						/>
						<SettingsButton
							icon={MessageCircle}
							label="Chats"
							onClick={() => setActiveTab('chats')}
							isActive={activeTab === 'chats'}
						/>
						<SettingsButton
							icon={Bell}
							label="Notifications"
							onClick={() => setActiveTab('notifications')}
							isActive={activeTab === 'notifications'}
						/>
						<SettingsButton
							icon={Info}
							label="About"
							onClick={() => setActiveTab('about')}
							isActive={activeTab === 'about'}
						/>
					</nav>
					<div className="border-t border-gray-200 dark:border-gray-700 p-2">
						<SettingsButton
							icon={LogOut}
							label="Log out"
							onClick={handleLogout}
							className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
						/>
					</div>
				</div>
				<div className="flex-1 bg-gray-50 dark:bg-gray-900">
					{renderContent()}
				</div>
			</div>
		</div>
	);
};

export default SettingsModal;