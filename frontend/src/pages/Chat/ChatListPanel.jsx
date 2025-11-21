import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useConversationStore } from '@/store/conversationStore';
import ChatListHeader from './ChatList/ChatListHeader';
import ChatItem from './ChatList/ChatItem';
import { renderSkeleton } from '@/skeletons/ChatPanel';

const ChatListPanel = ({
	isMobile = false,
	onChatSelect,
	showBackButton = false,
	onBack,
	popOutChats = [],
	onPopOutToggle
}) => {
	const {
		contacts,
		loadingContacts,
		fetchContacts,
	} = useConversationStore();

	const {
		error,
		selectedChatId,
		setSelectedChat,
	} = useChatStore();

	const { user: currentUser } = useAuthStore();

	// State management
	const [searchQuery, setSearchQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState('all');
	const [showFilters, setShowFilters] = useState(false);
	const [selectedChats, setSelectedChats] = useState(new Set());
	const [isSelectionMode, setIsSelectionMode] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [showScrollTop, setShowScrollTop] = useState(false);

	// Refs
	const listRef = useRef(null);
	const pullToRefreshThreshold = 100;
	const [pullDistance, setPullDistance] = useState(0);
	const [isPulling, setIsPulling] = useState(false);

	// Get chat name based on type and participants
	const getChatName = useCallback((chat) => {
		if (!chat) return 'Unknown Chat';

		if (chat.type === 'direct' && chat.participants && currentUser) {
			const otherParticipant = chat.participants.find(p => p._id !== currentUser._id);
			if (otherParticipant) {
				if (otherParticipant.firstName && otherParticipant.lastName) {
					return `${otherParticipant.firstName} ${otherParticipant.lastName}`;
				}
				return otherParticipant.firstName || otherParticipant.lastName || otherParticipant.username || otherParticipant.email || 'Unknown User';
			}
		}

		if (chat.type === 'group') {
			return `${chat.name || `Group ${chat.memberCount || 0}`}`;
		}

		return chat.name || 'Unnamed Chat';
	}, [currentUser]);

	const getLastMessageContent = useCallback((chat) => {
		if (!chat.lastMessage) {
			if ((chat.messageCount || 0) === 0) return 'No messages yet';
			return 'Tap to view messages';
		}

		if (typeof chat.lastMessage === 'string') {
			return chat.lastMessage;
		}

		if (chat.lastMessage.content) {
			return chat.lastMessage.content;
		}

		switch (chat.lastMessage.type || chat.lastMessage.messageType) {
			case 'image':
				return 'Photo';
			case 'video':
				return 'Video';
			case 'audio':
				return 'Audio';
			case 'file':
				return 'File';
			case 'location':
				return 'Location';
			default:
				return chat.lastMessage.content || 'Message';
		}
	}, []);

	// Memoized filtered and sorted contacts
	const filteredContacts = useMemo(() => {
		let filtered = contacts || [];

		if (searchQuery.trim()) {
			filtered = filtered.filter(chat => {
				const name = getChatName(chat).toLowerCase();
				const lastMessage = getLastMessageContent(chat).toLowerCase();
				const query = searchQuery.toLowerCase();
				return name.includes(query) || lastMessage.includes(query);
			});
		}

		switch (activeFilter) {
			case 'unread':
				filtered = filtered.filter(chat => (chat.unreadCount || 0) > 0);
				break;
			case 'archived':
				filtered = filtered.filter(chat => chat.isArchived);
				break;
			default:
				filtered = filtered.filter(chat => chat.isActive && !chat.isArchived);
		}

		return filtered.sort((a, b) => {
			const timeA = new Date(a.lastActivity || a.updatedAt || a.createdAt || 0);
			const timeB = new Date(b.lastActivity || b.updatedAt || b.createdAt || 0);
			return timeB - timeA;
		});
	}, [contacts, searchQuery, activeFilter, getChatName, getLastMessageContent]);

	// Get chat avatar
	const getChatAvatar = useCallback((chat) => {
		if (!chat) return null;

		if (chat.type === 'direct' && chat.participants && currentUser) {
			const otherParticipant = chat.participants.find(p => p._id !== currentUser._id);
			if (otherParticipant?.image) {
				return otherParticipant.image;
			}
			const name = getChatName(chat);
			return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=random&radius=50`;
		}

		return chat.avatar || null;
	}, [currentUser, getChatName]);

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
			if (onChatSelect) {
				onChatSelect(chatId);
			}
		}
	}, [isSelectionMode, selectedChats, setSelectedChat, onChatSelect]);

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

	return (
		<div className="flex flex-col h-full bg-white dark:bg-gray-800">
			<ChatListHeader
				showBackButton={showBackButton}
				onBack={onBack}
				isSelectionMode={isSelectionMode}
				selectedChats={selectedChats}
				setIsSelectionMode={setIsSelectionMode}
				setSelectedChats={setSelectedChats}
				searchQuery={searchQuery}
				setSearchQuery={setSearchQuery}
				showFilters={showFilters}
				setShowFilters={setShowFilters}
				activeFilter={activeFilter}
				setActiveFilter={setActiveFilter}
				contacts={contacts}
			/>

			{/* Pull to refresh indicator */}
			{isMobile && isPulling && (
				<div
					className="flex justify-center py-2 transition-all duration-200 bg-white/20 backdrop-blur-sm"
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
					<>{renderSkeleton()}</>
				) : error ? (
					<div className="flex flex-col items-center justify-center h-full text-red-500 dark:text-red-400 p-4 text-center">
						<p className="text-sm mb-3">{error}</p>
						<button
							onClick={fetchContacts}
							className="px-4 py-2 bg-red-100/60 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md hover:bg-red-200/60 dark:hover:bg-red-900/50 transition-all duration-200 text-sm font-medium backdrop-blur-sm border border-red-200/30"
						>
							Try Again
						</button>
					</div>
				) : filteredContacts.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-6 text-center">
						{searchQuery ? (
							<>
								<p className="text-lg font-semibold mb-2">No conversations found</p>
								<p className="text-sm mb-4 max-w-sm">
									Try searching with different keywords or check your spelling
								</p>
								<button
									onClick={() => setSearchQuery('')}
									className="px-4 py-2 bg-purple-100/60 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md hover:bg-purple-200/60 dark:hover:bg-purple-900/50 transition-all duration-200 text-sm font-medium backdrop-blur-sm border border-purple-200/30"
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
							</>
						)}
					</div>
				) : (
					<div className="divide-y divide-gray-100/30 dark:divide-gray-700/30">
						{filteredContacts.map(chat => (
							<ChatItem
								key={chat.conversationId}
								chat={chat}
								isSelected={selectedChats.has(chat.conversationId)}
								isSelectionMode={isSelectionMode}
								onSelect={handleChatSelect}
								getChatName={getChatName}
								getChatAvatar={getChatAvatar}
								popOutChats={popOutChats}
								onPopOutToggle={onPopOutToggle}
							/>
						))}
					</div>
				)}

				{/* Scroll to top button */}
				{showScrollTop && (
					<button
						onClick={scrollToTop}
						className="fixed bottom-6 right-6 w-12 h-12 bg-purple-500/90 hover:bg-purple-600/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 z-10 hover:scale-105 backdrop-blur-sm border border-white/20"
						aria-label="Scroll to top"
					>
						<ChevronDown className="h-6 w-6 rotate-180" />
					</button>
				)}
			</div>
		</div>
	);
};

export default ChatListPanel;