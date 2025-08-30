import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlobalSidebar from '@/components/GlobalSidebar';
import ChatListPanel from '@/pages/Chat/ChatListPanel';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { ArrowLeft, Menu, X } from 'lucide-react';

// Breakpoints
const BREAKPOINTS = {
	mobile: 768,
	tablet: 1024,
	desktop: 1280
};

// Panel dimensions
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 350;
const MOBILE_PANEL_WIDTH = '100vw';

const AppLayout = ({ children }) => {
	const navigate = useNavigate();
	const location = useLocation();
	const { user, isAuthenticated, initializeAuth } = useAuthStore();
	const {
		fetchContacts,
		fetchMessages,
		selectedChatId,
		initializeSocket,
		clearChatState,
		contacts
	} = useChatStore();

	// Responsive state
	const [screenSize, setScreenSize] = useState('desktop');
	const [isMobile, setIsMobile] = useState(false);
	const [isTablet, setIsTablet] = useState(false);
	const [showMobileMenu, setShowMobileMenu] = useState(false);
	const [showChatList, setShowChatList] = useState(true);

	// Panel width state
	const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
	const [isResizing, setIsResizing] = useState(false);

	// Refs for resize handling
	const isResizingRef = useRef(false);
	const startXRef = useRef(0);
	const startWidthRef = useRef(0);
	const layoutRef = useRef(null);

	// Check if we're on a chat page
	const isOnChatPage = location.pathname.startsWith('/chat/') && location.pathname !== '/chat';

	// --- Responsive Logic ---
	const updateScreenSize = useCallback(() => {
		const width = window.innerWidth;
		const mobile = width < BREAKPOINTS.mobile;
		const tablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.desktop;

		setIsMobile(mobile);
		setIsTablet(tablet);
		setScreenSize(mobile ? 'mobile' : tablet ? 'tablet' : 'desktop');

		// On mobile, hide chat list when viewing a specific chat
		if (mobile && isOnChatPage) {
			setShowChatList(false);
		} else if (!mobile) {
			setShowChatList(true);
		}

		// Close mobile menu on resize to larger screens
		if (!mobile && showMobileMenu) {
			setShowMobileMenu(false);
		}
	}, [isOnChatPage, showMobileMenu]);

	useEffect(() => {
		updateScreenSize();
		window.addEventListener('resize', updateScreenSize);
		return () => window.removeEventListener('resize', updateScreenSize);
	}, [updateScreenSize]);

	// --- Auth & Chat Store Initialization ---
	useEffect(() => {
		initializeAuth();
		initializeSocket();
		return () => clearChatState();
	}, [initializeAuth, initializeSocket, clearChatState]);

	useEffect(() => {
		if (isAuthenticated) {
			fetchContacts();
		}
	}, [isAuthenticated, fetchContacts]);

	useEffect(() => {
		if (selectedChatId) {
			fetchMessages(selectedChatId);
		}
	}, [selectedChatId, fetchMessages]);

	// --- Mobile Navigation Handlers ---
	const handleBackToChats = useCallback(() => {
		if (isMobile) {
			setShowChatList(true);
			navigate('/chat', { replace: true });
		}
	}, [isMobile, navigate]);

	const toggleMobileMenu = useCallback(() => {
		setShowMobileMenu(prev => !prev);
	}, []);

	// --- Panel Resize Logic (Desktop/Tablet only) ---
	const handleMouseMove = useCallback((e) => {
		if (!isResizingRef.current || isMobile) return;

		const deltaX = e.clientX - startXRef.current;
		let newWidth = startWidthRef.current + deltaX;
		newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, MAX_PANEL_WIDTH));
		setPanelWidth(newWidth);
	}, [isMobile]);

	const handleMouseUp = useCallback(() => {
		if (isResizingRef.current) {
			isResizingRef.current = false;
			setIsResizing(false);

			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			document.onselectstart = null;
		}
	}, [handleMouseMove]);

	const handleMouseDown = useCallback((e) => {
		if (isMobile) return;

		e.preventDefault();
		isResizingRef.current = true;
		setIsResizing(true);
		startXRef.current = e.clientX;
		startWidthRef.current = panelWidth;

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
		document.body.style.cursor = 'ew-resize';
		document.body.style.userSelect = 'none';
		document.onselectstart = () => false;
	}, [panelWidth, handleMouseMove, handleMouseUp, isMobile]);

	// Touch handlers for mobile gestures
	const handleTouchStart = useCallback((e) => {
		if (!isMobile || !isOnChatPage) return;

		const touch = e.touches[0];
		startXRef.current = touch.clientX;
	}, [isMobile, isOnChatPage]);

	const handleTouchMove = useCallback((e) => {
		if (!isMobile || !isOnChatPage) return;

		const touch = e.touches[0];
		const deltaX = touch.clientX - startXRef.current;

		// If swiping right from left edge, show back gesture
		if (startXRef.current < 50 && deltaX > 50) {
			// Add visual feedback for swipe gesture
			layoutRef.current?.style.setProperty('--swipe-progress', Math.min(deltaX / 100, 1));
		}
	}, [isMobile, isOnChatPage]);

	const handleTouchEnd = useCallback((e) => {
		if (!isMobile || !isOnChatPage) return;

		const touch = e.changedTouches[0];
		const deltaX = touch.clientX - startXRef.current;

		// If swipe is significant enough, go back
		if (startXRef.current < 50 && deltaX > 100) {
			handleBackToChats();
		}

		// Reset visual feedback
		layoutRef.current?.style.removeProperty('--swipe-progress');
	}, [isMobile, isOnChatPage, handleBackToChats]);

	// Cleanup effect
	useEffect(() => {
		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			document.onselectstart = null;
		};
	}, [handleMouseMove, handleMouseUp]);

	// Handle escape key to close mobile menu
	useEffect(() => {
		const handleEscape = (e) => {
			if (e.key === 'Escape' && showMobileMenu) {
				setShowMobileMenu(false);
			}
		};

		if (showMobileMenu) {
			document.addEventListener('keydown', handleEscape);
			return () => document.removeEventListener('keydown', handleEscape);
		}
	}, [showMobileMenu]);

	if (!isAuthenticated) {
		return null;
	}

	// Mobile Layout
	if (isMobile) {
		return (
			<div
				ref={layoutRef}
				className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900 relative"
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				style={{
					'--swipe-progress': '0'
				}}
			>
				{/* Mobile Header */}
				<div className="absolute top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 safe-area-top">
					<div className="flex items-center justify-between px-4 py-3">
						{/* Back button when viewing chat */}
						{isOnChatPage && !showChatList ? (
							<button
								onClick={handleBackToChats}
								className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-target"
							>
								<ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
						) : (
							<button
								onClick={toggleMobileMenu}
								className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-target"
							>
								<Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
						)}

						<h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
							{isOnChatPage && !showChatList ? 'Chat' : 'Kord'}
						</h1>

						<div className="w-9" /> {/* Spacer for centering */}
					</div>
				</div>

				{/* Mobile Menu Overlay */}
				{showMobileMenu && (
					<>
						<div
							className="fixed inset-0 bg-black bg-opacity-50 z-40"
							onClick={() => setShowMobileMenu(false)}
						/>
						<div className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-gray-800 z-50 transform transition-transform duration-300 safe-area-top">
							<div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
								<h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Menu</h2>
								<button
									onClick={() => setShowMobileMenu(false)}
									className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								>
									<X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
								</button>
							</div>
							<GlobalSidebar isMobile={true} onItemClick={() => setShowMobileMenu(false)} />
						</div>
					</>
				)}

				{/* Mobile Content */}
				<div className="flex-1 flex flex-col pt-16 safe-area-bottom">
					{/* Chat List or Main Content */}
					{showChatList ? (
						<ChatListPanel
							isMobile={true}
							onChatSelect={(chatId) => {
								setShowChatList(false);
								navigate(`/chat/${chatId}`);
							}}
						/>
					) : (
						<main className="flex-1 flex flex-col bg-white dark:bg-gray-800 min-w-0 overflow-hidden">
							{children}
						</main>
					)}
				</div>
			</div>
		);
	}

	// Desktop/Tablet Layout
	return (
		<div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
			{/* Global Navigation Sidebar */}
			<GlobalSidebar />

			{/* Chat List Panel - Resizable on desktop/tablet */}
			<div
				style={{
					width: isTablet ? '320px' : `${panelWidth}px`,
					minWidth: isTablet ? '320px' : `${MIN_PANEL_WIDTH}px`,
					maxWidth: isTablet ? '320px' : `${MAX_PANEL_WIDTH}px`
				}}
				className={`flex-shrink-0 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-w-0 ${!isResizing ? 'transition-none' : ''
					} ${isTablet ? 'tablet-panel' : ''}`}
			>
				<ChatListPanel />
			</div>

			{/* Resizer Handle - Desktop only */}
			{!isTablet && (
				<div
					className={`w-1 bg-gray-300 dark:bg-gray-600 cursor-ew-resize hover:bg-purple-500 dark:hover:bg-purple-400 transition-colors duration-150 flex-shrink-0 relative ${isResizing ? 'bg-purple-500 dark:bg-purple-400' : ''}`}
					onMouseDown={handleMouseDown}
					title="Drag to resize chat panel"
				>
					{/* Miniscus/handle in the center */}
					<div
						className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-6 bg-blue-400 dark:bg-blue-500 rounded-full opacity-70"
						style={{
							boxShadow: '0 0 2px 0.5px rgba(0,0,0,0.08)',
						}}
					/>
				</div>
			)}

			{/* Main Content Area */}
			<main className="flex-1 flex flex-col bg-white dark:bg-gray-800 min-w-0 overflow-hidden">
				{children}
			</main>
		</div>
	);
};

export default AppLayout;