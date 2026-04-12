import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlobalSidebar from '@/components/GlobalSidebar';
import ChatListPanel from '@/pages/Chat/ChatListPanel';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useConversationStore } from '@/store/conversationStore';
import { useMessageStore } from '@/store/messageStore';

// Breakpoints
const BREAKPOINTS = {
	mobile: 768,
	tablet: 1024,
	desktop: 1280
};

// Panel dimensions
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 500;
const DEFAULT_PANEL_WIDTH = 350;

// Minimum swipe distance to trigger navigation (px)
const SWIPE_THRESHOLD = 80;
// Max vertical movement allowed during a horizontal swipe (px)
const SWIPE_VERTICAL_TOLERANCE = 50;
// Only trigger from the left edge of the screen (px)
const EDGE_ZONE = 30;

const AppLayout = ({ children }) => {
	const navigate = useNavigate();
	const location = useLocation();
	const { user, isAuthenticated, initializeAuth } = useAuthStore();
	const {
		selectedChatId,
		initializeSocket,
		clearChatState,
		isMobileChatListVisible,
		setMobileChatListVisible,
		setSelectedChat,
	} = useChatStore();

	const { fetchContacts } = useConversationStore();
	const { fetchMessages } = useMessageStore();

	// Responsive state
	const [isMobile, setIsMobile] = useState(false);
	const [isTablet, setIsTablet] = useState(false);

	// Mobile viewport height (handles keyboard, address bar)
	const [mobileVh, setMobileVh] = useState(window.innerHeight);

	// Panel width state
	const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
	const [isResizing, setIsResizing] = useState(false);

	// Refs for resize handling
	const isResizingRef = useRef(false);
	const startXRef = useRef(0);
	const startYRef = useRef(0);
	const startWidthRef = useRef(0);
	const layoutRef = useRef(null);
	const swipeActiveRef = useRef(false);

	// Check if we're on a chat page
	const isOnChatPage = location.pathname.startsWith('/chat/') && location.pathname !== '/chat';

	// --- Mobile Viewport Height ---
	// Use visualViewport API to get the real visible height (accounts for keyboard, address bar)
	useEffect(() => {
		const updateVh = () => {
			const vh = window.visualViewport?.height || window.innerHeight;
			setMobileVh(vh);
			// Also set CSS custom property for use in styles
			document.documentElement.style.setProperty('--app-vh', `${vh}px`);
		};

		updateVh();

		// visualViewport resize fires when keyboard opens/closes and address bar changes
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', updateVh);
			window.visualViewport.addEventListener('scroll', updateVh);
		}
		window.addEventListener('resize', updateVh);

		return () => {
			if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', updateVh);
				window.visualViewport.removeEventListener('scroll', updateVh);
			}
			window.removeEventListener('resize', updateVh);
		};
	}, []);

	// --- Responsive Logic ---
	const updateScreenSize = useCallback(() => {
		const width = window.innerWidth;
		const mobile = width < BREAKPOINTS.mobile;
		const tablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.desktop;

		setIsMobile(mobile);
		setIsTablet(tablet);
		// On mobile, hide chat list when viewing a specific chat
		if (mobile && isOnChatPage) {
			setMobileChatListVisible(false);
		} else if (!mobile) {
			setMobileChatListVisible(true);
		}
	}, [isOnChatPage, setMobileChatListVisible]);

	useEffect(() => {
		updateScreenSize();
		window.addEventListener('resize', updateScreenSize);
		return () => window.removeEventListener('resize', updateScreenSize);
	}, [updateScreenSize]);

	useEffect(() => {
		if (!isMobile) return;
		if (location.pathname === '/chat') {
			setMobileChatListVisible(true);
		} else if (isOnChatPage) {
			setMobileChatListVisible(false);
		}
	}, [location.pathname, isMobile, isOnChatPage, setMobileChatListVisible]);

	// --- Browser Back/Forward Button Handling ---
	// Intercept popstate (browser back/forward) to properly sync mobile view state
	useEffect(() => {
		if (!isMobile) return;

		const handlePopState = () => {
			const path = window.location.pathname;

			if (path === '/chat' || path === '/dashboard' || path === '/') {
				// Going back to a list view — show chat list
				setSelectedChat(null);
				setMobileChatListVisible(true);
			} else if (path.startsWith('/chat/')) {
				// Going forward into a chat — hide chat list
				setMobileChatListVisible(false);
			}
			// For /login, /register — the AuthGuard handles these,
			// no need to manipulate mobile state
		};

		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, [isMobile, setMobileChatListVisible, setSelectedChat]);

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
			setSelectedChat(null);
			setMobileChatListVisible(true);
			navigate('/chat', { replace: true });
		}
	}, [isMobile, navigate, setMobileChatListVisible, setSelectedChat]);

	const handleMobileChatSelect = useCallback((chatId) => {
		setMobileChatListVisible(false);
		navigate(`/chat/${chatId}`);
	}, [navigate, setMobileChatListVisible]);

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

	// --- Mobile Swipe-to-Back Gesture ---
	// Only triggers from the left edge, requires primarily horizontal movement,
	// and always navigates to chat list (not browser history)
	const handleTouchStart = useCallback((e) => {
		if (!isMobile || !isOnChatPage) return;

		const touch = e.touches[0];
		startXRef.current = touch.clientX;
		startYRef.current = touch.clientY;
		swipeActiveRef.current = touch.clientX < EDGE_ZONE;
	}, [isMobile, isOnChatPage]);

	const handleTouchMove = useCallback((e) => {
		if (!isMobile || !isOnChatPage || !swipeActiveRef.current) return;

		const touch = e.touches[0];
		const deltaX = touch.clientX - startXRef.current;
		const deltaY = Math.abs(touch.clientY - startYRef.current);

		// If vertical movement exceeds tolerance, cancel the swipe
		if (deltaY > SWIPE_VERTICAL_TOLERANCE) {
			swipeActiveRef.current = false;
			layoutRef.current?.style.removeProperty('--swipe-progress');
			return;
		}

		// Only show visual feedback for rightward swipes
		if (deltaX > 0) {
			const progress = Math.min(deltaX / SWIPE_THRESHOLD, 1);
			layoutRef.current?.style.setProperty('--swipe-progress', progress);
		}
	}, [isMobile, isOnChatPage]);

	const handleTouchEnd = useCallback((e) => {
		if (!isMobile || !isOnChatPage || !swipeActiveRef.current) {
			swipeActiveRef.current = false;
			layoutRef.current?.style.removeProperty('--swipe-progress');
			return;
		}

		const touch = e.changedTouches[0];
		const deltaX = touch.clientX - startXRef.current;
		const deltaY = Math.abs(touch.clientY - startYRef.current);

		// Only trigger if primarily horizontal and past threshold
		if (deltaX > SWIPE_THRESHOLD && deltaY < SWIPE_VERTICAL_TOLERANCE) {
			// ALWAYS go to chat list — never use navigate(-1) which could go to login
			handleBackToChats();
		}

		// Reset
		swipeActiveRef.current = false;
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

	if (!isAuthenticated) {
		return null;
	}

	const showChatList = isMobile ? isMobileChatListVisible : true;

	// Mobile Layout
	if (isMobile) {
		return (
			<div
				ref={layoutRef}
				className="flex overflow-hidden bg-gray-100 dark:bg-gray-900 relative"
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				style={{
					'--swipe-progress': '0',
					height: `${mobileVh}px`,
					// Prevent iOS bounce-scroll on the layout container
					overscrollBehavior: 'none',
					// Use safe area insets for notched phones
					paddingTop: 'env(safe-area-inset-top)',
					paddingBottom: 'env(safe-area-inset-bottom)',
				}}
			>
				{/* Mobile Content - headers are handled by chat list / chat panels themselves (WhatsApp-style) */}
				<div className="flex-1 flex flex-col h-full overflow-hidden">
					{/* Chat List or Main Content */}
					{showChatList ? (
						<div className="flex-1 flex flex-col h-full overflow-hidden">
							<ChatListPanel
								isMobile={true}
								onChatSelect={handleMobileChatSelect}
							/>
						</div>
					) : (
						<main className="flex-1 flex flex-col bg-white dark:bg-gray-800 h-full overflow-hidden">
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
			{/* Global Navigation Sidebar - Fixed */}
			<GlobalSidebar />

			{/* Content Container - Offset by 65px for collapsed sidebar */}
			<div className="flex-1 flex ml-[65px] h-full overflow-hidden">
				{/* Chat List Panel - Resizable on desktop/tablet */}
				<div
					style={{
						width: isTablet ? '320px' : `${panelWidth}px`,
						minWidth: isTablet ? '320px' : `${MIN_PANEL_WIDTH}px`,
						maxWidth: isTablet ? '320px' : `${MAX_PANEL_WIDTH}px`
					}}
					className={`flex-shrink-0 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-full overflow-hidden ${!isResizing ? 'transition-none' : ''
						} ${isTablet ? 'tablet-panel' : ''}`}
				>
					<ChatListPanel />
				</div>

				{/* Resizer Handle - Desktop only */}
				{!isTablet && (
					<div
						className={`w-0.5 bg-gray-300 dark:bg-gray-600 cursor-ew-resize hover:bg-purple-500 dark:hover:bg-purple-400 transition-colors duration-150 flex-shrink-0 relative ${isResizing ? 'bg-purple-500 dark:bg-purple-400' : ''
							}`}
						onMouseDown={handleMouseDown}
						title="Drag to resize chat panel"
					>
						{/* Handle in the center */}
						<div
							className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-6 bg-gray-500 dark:bg-gray-400 rounded-full opacity-70 pointer-events-none"
							style={{
								boxShadow: '0 0 2px 0.5px rgba(0,0,0,0.08)',
							}}
						/>
					</div>
				)}

				{/* Main Content Area */}
				<main className="flex-1 flex flex-col bg-white dark:bg-gray-800 h-full overflow-hidden">
					{children}
				</main>
			</div>
		</div>
	);
};

export default AppLayout;