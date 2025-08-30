import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
	Search,
	Edit,
	ListFilter,
	Loader2,
	MessageCircleMore,
	Pin,
	Archive,
	Trash2,
	X,
	ChevronDown,
	Circle,
	Check,
	CheckCheck,
	Mic,
	Image,
	FileText,
	Video,
	Settings,
	MoreHorizontal,
	ArrowLeft,
	RefreshCw
} from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import NewChatModal from './NewChatModal';

const ChatListPanel = ({ isMobile = false, onChatSelect, showBackButton = false, onBack }) => {
	const {
		contacts,
		loadingContacts,
		error,
		fetchContacts,
		selectedChatId,
		setSelectedChat,
		archiveChat,
		deleteChat,
		pinChat,
		markAsRead,
		searchChats,
		onlineUsers
	} = useChatStore();

	// State management
	const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState('all'); // all, unread, groups, archived
	const [showFilters, setShowFilters] = useState(false);
	const [selectedChats, setSelectedChats] = useState(new Set());
	const [isSelectionMode, setIsSelectionMode] = useState(false);
	const [swipedChatId, setSwipedChatId] = useState(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [showScrollTop, setShowScrollTop] = useState(false);

	// Refs
	const searchInputRef = useRef(null);
	const listRef = useRef(null);
	const newChatButtonRef = useRef(null);
	const pullToRefreshThreshold = 100;
	const [pullDistance, setPullDistance] = useState(0);
	const [isPulling, setIsPulling] = useState(false);

	// Swipe handling state
	const [swipeStart, setSwipeStart] = useState(null);
	const [swipeDistance, setSwipeDistance] = useState(0);
	const [activeSwipeChat, setActiveSwipeChat] = useState(null);

	// Memoized filtered and sorted contacts
	const filteredContacts = useMemo(() => {
		let filtered = contacts;

		// Apply search filter
		if (searchQuery.trim()) {
			filtered = filtered.filter(chat =>
				chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				chat.phoneNumber?.includes(searchQuery)
			);
		}

		// Apply category filter
		switch (activeFilter) {
			case 'unread':
				filtered = filtered.filter(chat => chat.unreadCount > 0);
				break;
			case 'groups':
				filtered = filtered.filter(chat => chat.isGroup);
				break;
			case 'archived':
				filtered = filtered.filter(chat => chat.isArchived);
				break;
			default:
				filtered = filtered.filter(chat => !chat.isArchived);
		}

		// Sort by pinned, then by last message time
		return filtered.sort((a, b) => {
			if (a.isPinned && !b.isPinned) return -1;
			if (!a.isPinned && b.isPinned) return 1;
			return new Date(b.time || 0) - new Date(a.time || 0);
		});
	}, [contacts, searchQuery, activeFilter]);

	// Enhanced time formatting
	const formatLastMessageTime = useCallback((isoString) => {
		if (!isoString) return '';

		try {
			const date = new Date(isoString);

			if (isToday(date)) {
				return format(date, 'p'); // 9:05 AM
			} else if (isYesterday(date)) {
				return 'Yesterday';
			} else if (isThisWeek(date)) {
				return format(date, 'EEEE'); // Monday
			} else {
				return format(date, 'MM/dd/yy');
			}
		} catch (error) {
			console.error('Error formatting date:', error);
			return '';
		}
	}, []);

	// Generate avatar fallback
	const getAvatarFallback = useCallback((name) => {
		return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
	}, []);

	// Get message preview with media indicators
	const getMessagePreview = useCallback((chat) => {
		if (!chat.lastMessage) return 'No messages yet';

		const { lastMessage, lastMessageType, lastMessageSender } = chat;
		const senderPrefix = chat.isGroup && lastMessageSender ? `${lastMessageSender}: ` : '';

		switch (lastMessageType) {
			case 'image':
				return `${senderPrefix}📷 Photo`;
			case 'video':
				return `${senderPrefix}🎥 Video`;
			case 'audio':
				return `${senderPrefix}🎵 Audio`;
			case 'document':
				return `${senderPrefix}📄 Document`;
			case 'location':
				return `${senderPrefix}📍 Location`;
			default:
				return `${senderPrefix}${lastMessage}`;
		}
	}, []);

	// Handle chat selection
	const handleChatSelect = useCallback((chatId) => {
		if (isSelectionMode) {
			const newSelected = new Set(selectedChats);
			if (newSelected.has(chatId)) {
				newSelected.delete(chatId);
			} else {
				newSelected.add(chatId);
			}
			setSelectedChats(newSelected);

			if (newSelected.size === 0) {
				setIsSelectionMode(false);
			}
		} else {
			setSelectedChat(chatId);
			onChatSelect?.(chatId);
		}
	}, [isSelectionMode, selectedChats, setSelectedChat, onChatSelect]);

	// Handle long press for selection mode
	const handleLongPress = useCallback((chatId) => {
		if (!isSelectionMode) {
			setIsSelectionMode(true);
			setSelectedChats(new Set([chatId]));
		}
	}, [isSelectionMode]);

	// Swipe handlers - using native touch events instead of useSwipeable
	const handleTouchStartSwipe = useCallback((e, chatId) => {
		if (!isMobile) return;

		const touch = e.touches[0];
		setSwipeStart({
			x: touch.clientX,
			y: touch.clientY,
			chatId: chatId,
			time: Date.now()
		});
		setActiveSwipeChat(chatId);
	}, [isMobile]);

	const handleTouchMoveSwipe = useCallback((e, chatId) => {
		if (!isMobile || !swipeStart || swipeStart.chatId !== chatId) return;

		const touch = e.touches[0];
		const deltaX = swipeStart.x - touch.clientX;
		const deltaY = Math.abs(touch.clientY - swipeStart.y);

		// Only allow horizontal swipes
		if (deltaY < 50 && deltaX > 0) {
			e.preventDefault();
			setSwipeDistance(Math.min(deltaX, 150));
		}
	}, [isMobile, swipeStart]);

	const handleTouchEndSwipe = useCallback((e, chatId) => {
		if (!isMobile || !swipeStart || swipeStart.chatId !== chatId) return;

		if (swipeDistance > 75) {
			setSwipedChatId(chatId);
		} else {
			setSwipedChatId(null);
		}

		setSwipeStart(null);
		setSwipeDistance(0);
		setActiveSwipeChat(null);
	}, [isMobile, swipeStart, swipeDistance]);

	// Pull to refresh
	const handleTouchStart = useCallback((e) => {
		if (listRef.current?.scrollTop === 0) {
			setIsPulling(true);
		}
	}, []);

	const handleTouchMove = useCallback((e) => {
		if (isPulling && listRef.current?.scrollTop === 0) {
			const touch = e.touches[0];
			const startY = touch.clientY;
			const currentY = touch.clientY;
			const distance = Math.max(0, currentY - startY);
			setPullDistance(Math.min(distance, pullToRefreshThreshold * 1.5));
		}
	}, [isPulling, pullToRefreshThreshold]);

	const handleTouchEnd = useCallback(async () => {
		if (pullDistance >= pullToRefreshThreshold) {
			setIsRefreshing(true);
			try {
				await fetchContacts();
			} finally {
				setIsRefreshing(false);
			}
		}
		setIsPulling(false);
		setPullDistance(0);
	}, [pullDistance, pullToRefreshThreshold, fetchContacts]);

	// Scroll handling
	const handleScroll = useCallback(() => {
		if (listRef.current) {
			setShowScrollTop(listRef.current.scrollTop > 300);
		}
	}, []);

	const scrollToTop = useCallback(() => {
		listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
	}, []);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.ctrlKey || e.metaKey) {
				switch (e.key) {
					case 'k':
						e.preventDefault();
						searchInputRef.current?.focus();
						break;
					case 'n':
						e.preventDefault();
						setIsNewChatModalOpen(true);
						break;
				}
			}

			if (e.key === 'Escape') {
				if (isSelectionMode) {
					setIsSelectionMode(false);
					setSelectedChats(new Set());
				} else if (searchQuery) {
					setSearchQuery('');
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isSelectionMode, searchQuery]);

	// Auto-fetch contacts
	useEffect(() => {
		fetchContacts();
	}, [fetchContacts]);

	// Render skeleton loading
	const renderSkeleton = () => (
		<div className="divide-y divide-gray-100 dark:divide-gray-700">
			{Array.from({ length: 8 }).map((_, i) => (
				<div key={i} className="flex items-center p-3 animate-pulse">
					<div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mr-3"></div>
					<div className="flex-1">
						<div className="flex justify-between items-start mb-1">
							<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
							<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
						</div>
						<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
					</div>
				</div>
			))}
		</div>
	);

	// Render filter chips
	const renderFilterChips = () => (
		<div className="px-3 pb-2 flex space-x-2 overflow-x-auto scrollbar-hide">
			{[
				{ key: 'all', label: 'All', count: contacts.filter(c => !c.isArchived).length },
				{ key: 'unread', label: 'Unread', count: contacts.filter(c => c.unreadCount > 0).length },
				{ key: 'groups', label: 'Groups', count: contacts.filter(c => c.isGroup).length },
				{ key: 'archived', label: 'Archived', count: contacts.filter(c => c.isArchived).length }
			].map(filter => (
				<button
					key={filter.key}
					onClick={() => setActiveFilter(filter.key)}
					className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${activeFilter === filter.key
						? 'bg-purple-500 text-white'
						: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
						}`}
				>
					{filter.label}
					{filter.count > 0 && (
						<span className={`ml-1 text-xs ${activeFilter === filter.key ? 'text-purple-100' : 'text-gray-500'
							}`}>
							{filter.count}
						</span>
					)}
				</button>
			))}
		</div>
	);

	// Render chat item
	const renderChatItem = (chat) => {
		const isSelected = selectedChats.has(chat.id);
		const isOnline = onlineUsers?.includes(chat.id);
		const isSwiped = swipedChatId === chat.id;
		const isActiveSwipe = activeSwipeChat === chat.id;
		const currentSwipeDistance = isActiveSwipe ? swipeDistance : 0;

		return (
			<div
				key={chat.id}
				className={`relative transition-all duration-200 ${isSwiped ? '-translate-x-20' : 'translate-x-0'
					}`}
				style={{
					transform: isActiveSwipe ? `translateX(-${currentSwipeDistance}px)` : isSwiped ? 'translateX(-80px)' : 'translateX(0)'
				}}
			>
				{/* Swipe actions background */}
				{isMobile && (
					<div className="absolute inset-y-0 right-0 flex items-center space-x-2 px-4 bg-gradient-to-l from-red-500 to-orange-500">
						<button
							onClick={() => {
								archiveChat(chat.id);
								setSwipedChatId(null);
							}}
							className="p-2 bg-white/20 rounded-full"
						>
							<Archive className="h-5 w-5 text-white" />
						</button>
						<button
							onClick={() => {
								deleteChat(chat.id);
								setSwipedChatId(null);
							}}
							className="p-2 bg-white/20 rounded-full"
						>
							<Trash2 className="h-5 w-5 text-white" />
						</button>
					</div>
				)}

				{/* Chat item */}
				<div
					onClick={() => handleChatSelect(chat.id)}
					onContextMenu={(e) => {
						e.preventDefault();
						handleLongPress(chat.id);
					}}
					onTouchStart={(e) => handleTouchStartSwipe(e, chat.id)}
					onTouchMove={(e) => handleTouchMoveSwipe(e, chat.id)}
					onTouchEnd={(e) => handleTouchEndSwipe(e, chat.id)}
					className={`flex items-center p-3 cursor-pointer transition-colors duration-200 relative ${selectedChatId === chat.id && !isSelectionMode
						? 'bg-purple-50 dark:bg-purple-900/20 border-r-4 border-purple-600 dark:border-purple-400'
						: isSelected
							? 'bg-blue-50 dark:bg-blue-900/20'
							: 'hover:bg-gray-50 dark:hover:bg-gray-700'
						}`}
				>
					{/* Selection checkbox */}
					{isSelectionMode && (
						<div className="mr-3">
							<div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
								? 'bg-blue-500 border-blue-500'
								: 'border-gray-300 dark:border-gray-600'
								}`}>
								{isSelected && <Check className="h-4 w-4 text-white" />}
							</div>
						</div>
					)}

					{/* Avatar with online indicator */}
					<div className="relative w-12 h-12 rounded-full mr-3 flex-shrink-0 overflow-hidden bg-gradient-to-br from-purple-400 to-purple-600">
						{chat.avatar ? (
							<img
								src={chat.avatar}
								alt={chat.name}
								className="w-full h-full object-cover"
								onError={(e) => {
									e.target.style.display = 'none';
									e.target.nextSibling.style.display = 'flex';
								}}
							/>
						) : null}
						<div
							className={`w-full h-full ${chat.avatar ? 'hidden' : 'flex'} items-center justify-center text-white font-semibold text-sm`}
						>
							{getAvatarFallback(chat.name)}
						</div>

						{/* Online indicator */}
						{isOnline && !chat.isGroup && (
							<div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
						)}

						{/* Pinned indicator */}
						{chat.isPinned && (
							<div className="absolute top-0 right-0 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
								<Pin className="h-2 w-2 text-white" />
							</div>
						)}
					</div>

					{/* Chat info */}
					<div className="flex-1 min-w-0">
						<div className="flex justify-between items-start mb-1">
							<div className="flex items-center space-x-2 flex-1 min-w-0">
								<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
									{chat.name}
								</h3>
								{chat.isGroup && (
									<span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1 rounded">
										{chat.memberCount}
									</span>
								)}
							</div>
							<div className="flex items-center space-x-1 flex-shrink-0">
								<span className="text-xs text-gray-500 dark:text-gray-400">
									{formatLastMessageTime(chat.time)}
								</span>
								{chat.lastMessageStatus && (
									<div className="text-gray-500 dark:text-gray-400">
										{chat.lastMessageStatus === 'sent' && <Check className="h-3 w-3" />}
										{chat.lastMessageStatus === 'delivered' && <CheckCheck className="h-3 w-3" />}
										{chat.lastMessageStatus === 'read' && <CheckCheck className="h-3 w-3 text-blue-500" />}
									</div>
								)}
							</div>
						</div>

						<div className="flex justify-between items-center">
							<p className="text-xs text-gray-600 dark:text-gray-300 truncate pr-2 flex-1">
								{getMessagePreview(chat)}
							</p>

							<div className="flex items-center space-x-2 flex-shrink-0">
								{/* Muted indicator */}
								{chat.isMuted && (
									<div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center">
										<span className="text-xs text-white">🔇</span>
									</div>
								)}

								{/* Unread count */}
								{chat.unreadCount > 0 && (
									<span className={`text-xs rounded-full px-2 py-1 min-w-[20px] text-center font-medium ${chat.isMuted
										? 'bg-gray-400 text-white'
										: 'bg-purple-500 text-white'
										}`}>
										{chat.unreadCount > 99 ? '99+' : chat.unreadCount}
									</span>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col h-full bg-white dark:bg-gray-800">
			{/* Header */}
			<div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
				<div className="flex items-center space-x-3">
					{showBackButton && (
						<button
							onClick={onBack}
							className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							<ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
						</button>
					)}
					<h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100">
						{isSelectionMode ? `${selectedChats.size} selected` : 'Chats'}
					</h2>
				</div>

				<div className="flex items-center space-x-2">
					{isSelectionMode ? (
						<>
							<button
								onClick={() => {
									selectedChats.forEach(chatId => archiveChat(chatId));
									setIsSelectionMode(false);
									setSelectedChats(new Set());
								}}
								className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								title="Archive selected"
							>
								<Archive className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
							<button
								onClick={() => {
									setIsSelectionMode(false);
									setSelectedChats(new Set());
								}}
								className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								title="Cancel selection"
							>
								<X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
						</>
					) : (
						<>
							<button
							ref={newChatButtonRef}
								onClick={() => setIsNewChatModalOpen((prev) => !prev)}
								className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								title="New Chat (Ctrl+N)"
							>
								<Edit className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
							<button
								onClick={() => setShowFilters(!showFilters)}
								className={`p-2 rounded-full transition-colors ${showFilters
									? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
									: 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
									}`}
								title="Filter Chats"
							>
								<ListFilter className="h-5 w-5" />
							</button>
							<button
								onClick={() => setIsSelectionMode(true)}
								className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								title="Select chats"
							>
								<MoreHorizontal className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
						</>
					)}
				</div>
			</div>

			{/* Search Bar */}
			<div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div className="relative">
					<input
						ref={searchInputRef}
						type="text"
						placeholder="Search or start a new chat (Ctrl+K)"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-gray-600 transition-all duration-200"
					/>
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-gray-400" />
					{searchQuery && (
						<button
							onClick={() => setSearchQuery('')}
							className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
						>
							<X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
						</button>
					)}
				</div>
			</div>

			{/* Filter Chips */}
			{showFilters && renderFilterChips()}

			{/* Pull to refresh indicator */}
			{isMobile && isPulling && (
				<div
					className="flex justify-center py-2 transition-all duration-200"
					style={{ transform: `translateY(${Math.min(pullDistance, pullToRefreshThreshold)}px)` }}
				>
					<RefreshCw
						className={`h-6 w-6 text-gray-400 transition-transform duration-200 ${pullDistance >= pullToRefreshThreshold ? 'animate-spin' : ''
							}`}
					/>
				</div>
			)}

			{/* Chat List */}
			<div
				ref={listRef}
				className="flex-1 overflow-y-auto relative"
				onScroll={handleScroll}
				onTouchStart={isMobile ? handleTouchStart : undefined}
				onTouchMove={isMobile ? handleTouchMove : undefined}
				onTouchEnd={isMobile ? handleTouchEnd : undefined}
			>
				{loadingContacts ? (
					renderSkeleton()
				) : error ? (
					<div className="flex flex-col items-center justify-center h-full text-red-500 dark:text-red-400 p-4 text-center">
						<p className="text-sm mb-3">{error}</p>
						<button
							onClick={fetchContacts}
							className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
						>
							Try Again
						</button>
					</div>
				) : filteredContacts.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-6 text-center">
						<MessageCircleMore className="w-16 h-16 mb-4 opacity-50" />
						{searchQuery ? (
							<>
								<p className="text-lg font-semibold mb-2">No chats found</p>
								<p className="text-sm mb-4 max-w-sm">
									Try searching with different keywords or check your spelling
								</p>
								<button
									onClick={() => setSearchQuery('')}
									className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium"
								>
									Clear search
								</button>
							</>
						) : (
							<>
								<p className="text-lg font-semibold mb-2">No conversations yet</p>
								<p className="text-sm mb-4 max-w-sm">
									Start a conversation by clicking the new chat button
								</p>
								<button
									onClick={() => setIsNewChatModalOpen(true)}
									className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors text-sm font-medium"
								>
									Start chatting
								</button>
							</>
						)}
					</div>
				) : (
					<div className="divide-y divide-gray-100 dark:divide-gray-700">
						{filteredContacts.map(renderChatItem)}
					</div>
				)}

				{/* Scroll to top button */}
				{showScrollTop && (
					<button
						onClick={scrollToTop}
						className="fixed bottom-6 right-6 w-12 h-12 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 z-10 hover:scale-105"
						aria-label="Scroll to top"
					>
						<ChevronDown className="h-6 w-6 rotate-180" />
					</button>
				)}
			</div>

			{/* New Chat Modal */}
			<NewChatModal
				isOpen={isNewChatModalOpen}
				onClose={() => setIsNewChatModalOpen(false)}
				anchorRef={newChatButtonRef}
			/>
		</div>
	);
};

export default ChatListPanel;