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

	// New swipe back handler to avoid NotFound page
	const handleSwipeBack = useCallback(() => {
		if (window.history.length > 1) {
			navigate(-1);
		} else {
			navigate('/dashboard', { replace: true });
		}
	}, [navigate]);

	const handleTouchEnd = useCallback((e) => {
		if (!isMobile || !isOnChatPage) return;

		const touch = e.changedTouches[0];
		const deltaX = touch.clientX - startXRef.current;

		// If swipe is significant enough, go back using the new logic
		if (startXRef.current < 50 && deltaX > 100) {
			handleSwipeBack();
		}

		// Reset visual feedback
		layoutRef.current?.style.removeProperty('--swipe-progress');
	}, [isMobile, isOnChatPage, handleSwipeBack]);

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
				className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900 relative"
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				style={{
					'--swipe-progress': '0'
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