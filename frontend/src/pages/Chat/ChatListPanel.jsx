import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Edit, ListFilter, MessageCircleMore, Pin, Archive, Trash2, X, ChevronDown, Check, CheckCheck, Clock, Mic, Image, FileText, Video, MoreHorizontal, ArrowLeft, RefreshCw, Star, VolumeX, ExternalLink, MapPin } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { renderSkeleton } from '@/skeletons/ChatPanel';
import { useAuthStore } from '@/store/authStore';
import NewChatModal from './NewChatModal';
import { isToday, isYesterday, isThisWeek } from "date-fns";

const formatTime = (date) => {
	return date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
};

const formatWeekday = (date) => {
	return date.toLocaleDateString('en-US', { weekday: 'long' });
};

const ChatListPanel = ({ isMobile = false, onChatSelect, showBackButton = false, onBack, popOutChats = [], onPopOutToggle }) => {
	const {
		contacts,
		loadingContacts,
		error,
		fetchContacts,
		selectedChatId,
		setSelectedChat,
		onlineUsers,
		getTypingUsers,
		isUserOnline
	} = useChatStore();

	const { user: currentUser } = useAuthStore();

	// State management
	const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState('all');
	const [showFilters, setShowFilters] = useState(false);
	const [selectedChats, setSelectedChats] = useState(new Set());
	const [isSelectionMode, setIsSelectionMode] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [showScrollTop, setShowScrollTop] = useState(false);
	const [contextMenu, setContextMenu] = useState(null);
	const [hoveredChat, setHoveredChat] = useState(null);

	// Refs
	const searchInputRef = useRef(null);
	const listRef = useRef(null);
	const newChatButtonRef = useRef(null);
	const contextMenuRef = useRef(null);
	const pullToRefreshThreshold = 100;
	const [pullDistance, setPullDistance] = useState(0);
	const [isPulling, setIsPulling] = useState(false);

	// Memoized filtered and sorted contacts
	const filteredContacts = useMemo(() => {
		let filtered = contacts;

		// Apply search filter
		if (searchQuery.trim()) {
			filtered = filtered.filter(chat => {
				const name = getChatName(chat).toLowerCase();
				const lastMessage = getLastMessageContent(chat).toLowerCase();
				const query = searchQuery.toLowerCase();
				return name.includes(query) || lastMessage.includes(query);
			});
		}

		// Apply category filter
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
	}, [contacts, searchQuery, activeFilter]);

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

		return chat.name || `Group ${chat.memberCount || 0}`;
	}, [currentUser]);

	// Get chat avatar
	const getChatAvatar = useCallback((chat) => {
		if (!chat) return null;

		if (chat.avatar) return chat.avatar;

		if (chat.type === 'direct' && chat.participants && currentUser) {
			const otherParticipant = chat.participants.find(p => p._id !== currentUser._id);
			if (otherParticipant?.image) {
				return otherParticipant.image;
			}
			// Generate avatar if no image
			const name = getChatName(chat);
			return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=random&radius=50`;
		}

		return chat.avatar || null;
	}, [currentUser, getChatName]);

	// Get last message content
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

		// Handle different message types
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

	// Get message type icon
	const getMessageTypeIcon = useCallback((chat) => {
		const messageType = chat.lastMessage?.type || chat.lastMessage?.messageType;

		switch (messageType) {
			case 'image':
				return <Image className="w-4 h-4 text-gray-500" />;
			case 'video':
				return <Video className="w-4 h-4 text-gray-500" />;
			case 'audio':
				return <Mic className="w-4 h-4 text-gray-500" />;
			case 'file':
				return <FileText className="w-4 h-4 text-gray-500" />;
			case 'location':
				return <MapPin className="w-4 h-4 text-gray-500" />;
			default:
				return null;
		}
	}, []);

	// Get message status icon
	const getMessageStatusIcon = useCallback((chat) => {
		const lastMessage = chat.lastMessage;
		if (!lastMessage || !currentUser) return null;

		// Only show status for messages sent by current user
		const isSentByCurrentUser = lastMessage.sender === currentUser._id ||
			(typeof lastMessage.sender === 'object' && lastMessage.sender?._id === currentUser._id);

		if (!isSentByCurrentUser) return null;

		const status = lastMessage.deliveryStatus || lastMessage.status || 'sent';

		switch (status) {
			case 'sending':
				return <Clock className="w-3 h-3 text-gray-400" />;
			case 'sent':
				return <Check className="w-3 h-3 text-gray-400" />;
			case 'delivered':
				return <CheckCheck className="w-3 h-3 text-gray-400" />;
			case 'read':
				return <CheckCheck className="w-3 h-3 text-blue-500" />;
			default:
				return <Check className="w-3 h-3 text-gray-400" />;
		}
	}, [currentUser]);

	// Enhanced time formatting
	const formatLastMessageTime = useCallback((isoString) => {
		if (!isoString) return '';

		try {
			const date = new Date(isoString);

			if (isToday(date)) {
				return formatTime(date);
			} else if (isYesterday(date)) {
				return 'Yesterday';
			} else if (isThisWeek(date)) {
				return formatWeekday(date);
			} else {
				return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
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

	// Check if user is online
	const isUserOnlineCheck = useCallback((chat) => {
		if (!onlineUsers || !chat.participants || !currentUser) return false;

		if (chat.type === 'direct') {
			const otherParticipant = chat.participants.find(p => p._id !== currentUser._id);
			return otherParticipant && onlineUsers.includes(otherParticipant._id);
		}

		return chat.participants.some(participant =>
			onlineUsers.includes(participant._id)
		);
	}, [onlineUsers, currentUser]);

	// Check if user is typing
	const isUserTyping = useCallback((chat) => {
		if (!getTypingUsers) return false;
		const typingUsers = getTypingUsers(chat.conversationId);
		return typingUsers.length > 0;
	}, [getTypingUsers]);

	// Handle context menu
	const handleContextMenu = useCallback((e, chat) => {
		e.preventDefault();
		e.stopPropagation();

		setContextMenu({
			chat,
			x: e.clientX,
			y: e.clientY
		});
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
			if (onChatSelect) {
				onChatSelect(chatId);
			}
		}
		setContextMenu(null);
	}, [isSelectionMode, selectedChats, setSelectedChat, onChatSelect]);

	// Handle long press for selection mode
	const handleLongPress = useCallback((chatId) => {
		if (!isSelectionMode) {
			setIsSelectionMode(true);
			setSelectedChats(new Set([chatId]));
		}
	}, [isSelectionMode]);

	// Handle pop-out toggle
	const handlePopOutToggle = useCallback((chatId) => {
		if (onPopOutToggle) {
			onPopOutToggle(chatId);
		}
		setContextMenu(null);
	}, [onPopOutToggle]);

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

	// Close context menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (e) => {
			if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
				setContextMenu(null);
			}
		};

		if (contextMenu) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [contextMenu]);

	// Mock functions for missing store methods
	const archiveChat = useCallback((chatId) => {
		console.log("Archive chat:", chatId);
	}, []);

	const deleteChat = useCallback((chatId) => {
		console.log("Delete chat:", chatId);
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
				} else if (contextMenu) {
					setContextMenu(null);
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isSelectionMode, searchQuery, contextMenu]);

	// Auto-fetch contacts
	useEffect(() => {
		fetchContacts();
	}, [fetchContacts]);

	// Render filter chips
	const renderFilterChips = () => (
		<div className="px-3 pb-2 flex space-x-2 overflow-x-auto scrollbar-hide">
			{[
				{ key: 'all', label: 'All', count: contacts.filter(c => c.isActive && !c.isArchived).length },
				{ key: 'unread', label: 'Unread', count: contacts.filter(c => (c.unreadCount || 0) > 0).length },
				{ key: 'archived', label: 'Archived', count: contacts.filter(c => c.isArchived).length }
			].map(filter => (
				<button
					key={filter.key}
					onClick={() => setActiveFilter(filter.key)}
					className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 backdrop-blur-md ${activeFilter === filter.key
						? 'bg-white/20 text-purple-600 shadow-lg border border-white/30'
						: 'bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/20 border border-white/10'
						}`}
				>
					{filter.label}
					{filter.count > 0 && (
						<span className={`ml-1 text-xs ${activeFilter === filter.key ? 'text-purple-500' : 'text-gray-500'
							}`}>
							{filter.count}
						</span>
					)}
				</button>
			))}
		</div>
	);

	// Render chat item with liquid glass effects
	const renderChatItem = (chat) => {
		const isSelected = selectedChats.has(chat.conversationId);
		const isOnline = isUserOnlineCheck(chat);
		const isTyping = isUserTyping(chat);
		const chatName = getChatName(chat);
		const chatAvatar = getChatAvatar(chat);
		const messageTypeIcon = getMessageTypeIcon(chat);
		const statusIcon = getMessageStatusIcon(chat);

		const isSelectedChat = selectedChatId === chat.conversationId;
		const isPopOut = popOutChats?.includes(chat.conversationId);

		const isDirect = chat.type === 'direct';

		return (
			<div key={chat.conversationId} className="relative group">
				<div
					onClick={() => handleChatSelect(chat.conversationId)}
					onContextMenu={(e) => handleContextMenu(e, chat)}
					onMouseEnter={() => setHoveredChat(chat.conversationId)}
					onMouseLeave={() => setHoveredChat(null)}
					className={`
					group relative px-4 py-3 mx-2 my-0.5 rounded-2xl cursor-pointer 
					transition-all duration-300 ease-out
					${isSelectedChat && !isSelectionMode
							? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 shadow-lg shadow-blue-500/20 dark:shadow-blue-400/10 border border-blue-200 dark:border-blue-700/60'
							: isSelected
								? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 shadow-lg shadow-blue-500/20 dark:shadow-blue-400/10 border border-blue-200 dark:border-blue-700/60'
								: 'hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:shadow-md hover:shadow-gray-500/20 dark:hover:shadow-black/20 active:scale-[0.98] border border-transparent hover:border-gray-200 dark:hover:border-slate-700'
						}
					${hoveredChat === chat.conversationId ? 'transform translate-x-1' : ''}
				`}
				>
					{isSelectedChat && (
						<div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 rounded-r-full" />
					)}

					<div className="flex items-center gap-3 relative">
						{/* Selection checkbox */}
						{isSelectionMode && (
							<div className="mr-3">
								<div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300
								${isSelected
										? 'bg-blue-500 dark:bg-blue-400 border-blue-500 dark:border-blue-400 shadow-lg shadow-blue-500/30'
										: 'border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 hover:border-gray-400 dark:hover:border-gray-500'
									}`}>
									{isSelected && <Check className="h-4 w-4 text-white" />}
								</div>
							</div>
						)}

						{/* Avatar with online indicator */}
						<div className="relative flex-shrink-0">
							{isDirect ? (
								<>
									<div className={`
									h-12 w-12 rounded-full overflow-hidden ring-2 transition-all duration-300
									${isSelectedChat || isSelected
											? 'ring-blue-300 dark:ring-blue-500/60 shadow-lg shadow-blue-500/25'
											: 'ring-gray-200 dark:ring-slate-700 group-hover:ring-gray-300 dark:group-hover:ring-slate-600'
										}`}>
										{chatAvatar ? (
											<img
												src={chatAvatar}
												alt={chatName}
												className="w-full h-full object-cover"
												onError={(e) => {
													e.target.style.display = 'none';
													e.target.nextSibling.style.display = 'flex';
												}}
											/>
										) : null}
										<div
											className={`w-full h-full ${chatAvatar ? 'hidden' : 'flex'} items-center justify-center text-white font-semibold text-sm bg-gradient-to-br from-gray-500 to-gray-600 dark:from-slate-600 dark:to-slate-700`}
										>
											{getAvatarFallback(chatName)}
										</div>
									</div>
									{/* Online indicator */}
									{isOnline && (
										<div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900 shadow-lg">
											<div className="w-full h-full bg-emerald-400 rounded-full animate-pulse" />
										</div>
									)}
								</>
							) : (
								<div className={`
								h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold
								transition-all duration-300 shadow-lg
								${isSelectedChat || isSelected
										? 'bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-800/60 dark:to-blue-800/60 border-2 border-blue-300 dark:border-blue-600/60 text-indigo-700 dark:text-blue-300'
										: 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800 border-2 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 group-hover:border-gray-300 dark:group-hover:border-slate-500 group-hover:from-gray-200 group-hover:to-gray-300 dark:group-hover:from-slate-600 dark:group-hover:to-slate-700'
									}`}>
									#
								</div>
							)}
						</div>

						{/* Chat info */}
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between mb-1">
								<div className="flex items-center space-x-2 flex-1 min-w-0">
									<h3 className={`font-semibold text-sm truncate transition-colors duration-200
									${isSelectedChat || isSelected
											? 'text-blue-900 dark:text-blue-100'
											: 'text-gray-900 dark:text-slate-200 group-hover:text-gray-800 dark:group-hover:text-slate-100'}`}>
										{chatName}
									</h3>
									{chat.type !== 'direct' && chat.memberCount && (
										<span className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors duration-200
										${isSelectedChat || isSelected
												? 'text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-800/40 border-blue-200 dark:border-blue-700'
												: 'text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
											}`}>
											{chat.memberCount}
										</span>
									)}
									{chat.isArchived && (
										<Archive className={`h-3 w-3 transition-colors duration-200
										${isSelectedChat || isSelected
												? 'text-blue-600 dark:text-blue-400'
												: 'text-gray-400 dark:text-slate-500'}`} />
									)}
								</div>

								<div className="flex items-center gap-2 flex-shrink-0 ml-2">
									<span className={`text-xs font-medium transition-colors duration-200
									${isSelectedChat || isSelected
											? 'text-blue-600 dark:text-blue-300'
											: 'text-gray-500 dark:text-slate-400 group-hover:text-gray-600 dark:group-hover:text-slate-300'}`}>
										{formatLastMessageTime(chat.lastActivity || chat.updatedAt)}
									</span>
									{(chat.unreadCount || 0) > 0 && (
										<div className="bg-gradient-to-r from-red-500 to-red-600 dark:from-red-400 dark:to-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] h-5 flex items-center justify-center shadow-lg shadow-red-500/30 ring-2 ring-red-100 dark:ring-red-900/50">
											{chat.unreadCount > 99 ? '99+' : chat.unreadCount}
										</div>
									)}
								</div>
							</div>

							<div className="flex items-center justify-between">
								<div className={`text-xs truncate transition-colors duration-200 pr-2
								${isTyping
										? 'text-emerald-600 dark:text-emerald-400 italic font-medium'
										: isSelectedChat || isSelected
											? 'text-blue-700 dark:text-blue-200'
											: 'text-gray-600 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-slate-300'
									}`}>
									{isTyping ? (
										<div className="flex items-center gap-1">
											<span>typing</span>
											<div className="flex gap-0.5">
												<div className="w-1 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
												<div className="w-1 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
												<div className="w-1 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
											</div>
										</div>
									) : (
										<div className="flex items-center space-x-2">
											{messageTypeIcon}
											<span>{getLastMessageContent(chat)}</span>
										</div>
									)}
								</div>
								<div className="flex items-center gap-1 flex-shrink-0">
									{statusIcon}
								</div>
							</div>
						</div>
					</div>

					<div className={`absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-slate-600 transition-opacity duration-300 ${hoveredChat === chat.conversationId ? 'opacity-100' : 'opacity-0'}`} />
				</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col h-full bg-white dark:bg-gray-800">
			{/* Header with liquid glass effect */}
			<div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0 bg-white/80 backdrop-blur-lg dark:bg-gray-800/80">
				<div className="flex items-center space-x-3">
					{showBackButton && (
						<button
							onClick={onBack}
							className="p-1 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
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
								className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
								title="Archive selected"
							>
								<Archive className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
							<button
								onClick={() => {
									setIsSelectionMode(false);
									setSelectedChats(new Set());
								}}
								className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
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
								className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
								title="New Chat (Ctrl+N)"
							>
								<Edit className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
							<button
								onClick={() => setShowFilters(!showFilters)}
								className={`p-2 rounded-full transition-all duration-200 backdrop-blur-sm ${showFilters
									? 'bg-purple-100/60 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shadow-md'
									: 'hover:bg-white/20 dark:hover:bg-gray-700/20 text-gray-600 dark:text-gray-300'
									}`}
								title="Filter Chats"
							>
								<ListFilter className="h-5 w-5" />
							</button>
							<button
								onClick={() => setIsSelectionMode(true)}
								className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
								title="Select chats"
							>
								<MoreHorizontal className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
						</>
					)}
				</div>
			</div>

			{/* Search Bar with liquid glass effect */}
			<div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div className="relative">
					<input
						ref={searchInputRef}
						type="text"
						placeholder="Search conversations (Ctrl+K)"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-10 pr-4 py-2 bg-white/30 dark:bg-gray-700/30 backdrop-blur-lg rounded-lg text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:bg-white/50 dark:focus:bg-gray-600/50 transition-all duration-200 border border-white/20 shadow-md"
					/>
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-gray-400" />
					{searchQuery && (
						<button
							onClick={() => setSearchQuery('')}
							className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-white/20 dark:hover:bg-gray-600/20 rounded-full transition-all duration-200 backdrop-blur-sm"
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
					renderSkeleton()
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
						<MessageCircleMore className="w-16 h-16 mb-4 opacity-50" />
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
								<button
									onClick={() => setIsNewChatModalOpen(true)}
									className="px-4 py-2 bg-purple-500/80 text-white rounded-md hover:bg-purple-600/80 transition-all duration-200 text-sm font-medium backdrop-blur-sm shadow-lg"
								>
									Start chatting
								</button>
							</>
						)}
					</div>
				) : (
					<div className="divide-y divide-gray-100/30 dark:divide-gray-700/30">
						{filteredContacts.map(renderChatItem)}
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

			{/* Context Menu with liquid glass effect */}
			{contextMenu && (
				<div
					ref={contextMenuRef}
					className="fixed z-50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/30 dark:border-gray-600/30 rounded-xl shadow-2xl min-w-[200px] overflow-hidden"
					style={{
						left: Math.min(contextMenu.x, window.innerWidth - 220),
						top: Math.min(contextMenu.y, window.innerHeight - 400)
					}}
				>
					<div className="py-2">
						<button
							onClick={() => {
								// Mark as unread functionality
								setContextMenu(null);
							}}
							className="w-full px-4 py-3 text-left hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 flex items-center space-x-3 text-gray-800 dark:text-gray-200"
						>
							<MessageCircleMore className="w-4 h-4" />
							<span>Mark as unread</span>
						</button>

						<button
							onClick={() => {
								// Pin to top functionality
								setContextMenu(null);
							}}
							className="w-full px-4 py-3 text-left hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 flex items-center space-x-3 text-gray-800 dark:text-gray-200"
						>
							<Pin className="w-4 h-4" />
							<span>Pin to top</span>
						</button>

						<button
							onClick={() => {
								// Add to favorites functionality
								setContextMenu(null);
							}}
							className="w-full px-4 py-3 text-left hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 flex items-center space-x-3 text-gray-800 dark:text-gray-200"
						>
							<Star className="w-4 h-4" />
							<span>Add to favorites</span>
						</button>

						<button
							onClick={() => {
								// Mute functionality
								setContextMenu(null);
							}}
							className="w-full px-4 py-3 text-left hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 flex items-center space-x-3 text-gray-800 dark:text-gray-200"
						>
							<VolumeX className="w-4 h-4" />
							<span>Mute</span>
						</button>

						<div className="border-t border-gray-200/30 dark:border-gray-600/30 my-2"></div>

						<button
							onClick={() => {
								selectedChats.forEach(chatId => archiveChat(chatId));
								setContextMenu(null);
							}}
							className="w-full px-4 py-3 text-left hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 flex items-center space-x-3 text-gray-800 dark:text-gray-200"
						>
							<Archive className="w-4 h-4" />
							<span>Archive</span>
						</button>

						<button
							onClick={() => {
								// Clear messages functionality
								setContextMenu(null);
							}}
							className="w-full px-4 py-3 text-left hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 flex items-center space-x-3 text-gray-800 dark:text-gray-200"
						>
							<Trash2 className="w-4 h-4" />
							<span>Clear messages</span>
						</button>

						<button
							onClick={() => {
								// Delete chat functionality
								setContextMenu(null);
							}}
							className="w-full px-4 py-3 text-left hover:bg-white/20 dark:hover:bg-red-700/20 transition-all duration-200 flex items-center space-x-3 text-red-600 dark:text-red-400"
						>
							<Trash2 className="w-4 h-4" />
							<span>Delete</span>
						</button>

						<div className="border-t border-gray-200/30 dark:border-gray-600/30 my-2"></div>

						<button
							onClick={() => handlePopOutToggle(contextMenu.chat.conversationId)}
							className="w-full px-4 py-3 text-left hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 flex items-center space-x-3 text-gray-800 dark:text-gray-200"
						>
							<ExternalLink className="w-4 h-4" />
							<span>
								{popOutChats?.includes(contextMenu.chat.conversationId) ? 'Close chat' : 'Pop-out chat'}
							</span>
						</button>
					</div>
				</div>
			)}

			{/* New Chat Modal */}
			<NewChatModal
				isOpen={isNewChatModalOpen}
				onClose={() => setIsNewChatModalOpen(false)}
				anchorRef={newChatButtonRef}
			/>
		</div>
	);
}

export default ChatListPanel;