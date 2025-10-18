import { useState, useCallback } from 'react';
import {
	Check, CheckCheck, Clock, Mic, Image, FileText, Video, MapPin,
	Archive, MessageCircleMore, Pin, Star, VolumeX, Trash2, ExternalLink, X
} from 'lucide-react';
import { isToday, isYesterday, isThisWeek } from 'date-fns';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';

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

const ChatItem = ({
	chat,
	isSelected,
	isSelectionMode,
	onSelect,
	getChatName,
	getChatAvatar,
	popOutChats = [],
	onPopOutToggle,
}) => {
	const [hoveredChat, setHoveredChat] = useState(null);

	// Import stores directly
	const { user: currentUser } = useAuthStore();
	const {
		selectedChatId,
		setSelectedChat,
		onlineUsers,
		getTypingUsers
	} = useChatStore();

	const isSelectedChat = selectedChatId === chat.conversationId;
	const isPopOut = popOutChats.includes(chat.conversationId);

	const isOnline = useCallback(() => {
		if (!onlineUsers || !chat.participants || !currentUser) return false;

		if (chat.type === 'direct') {
			const otherParticipant = chat.participants.find(p => p._id !== currentUser._id);
			return otherParticipant && onlineUsers.includes(otherParticipant._id);
		}

		return chat.participants.some(participant =>
			onlineUsers.includes(participant._id)
		);
	}, [onlineUsers, chat, currentUser]);

	const isTyping = useCallback(() => {
		if (!getTypingUsers) return false;
		const typingUsers = getTypingUsers(chat.conversationId);
		return typingUsers.length > 0;
	}, [getTypingUsers, chat.conversationId]);

	const getLastMessageContent = useCallback(() => {
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
	}, [chat]);

	const getMessageTypeIcon = useCallback(() => {
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
	}, [chat]);

	const getMessageStatusIcon = useCallback(() => {
		const lastMessage = chat.lastMessage;
		if (!lastMessage || !currentUser) return null;

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
	}, [chat, currentUser]);

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

	const getAvatarFallback = useCallback((name) => {
		return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
	}, []);

	// Handle pop-out toggle with smart selection logic
	const handlePopOutToggle = useCallback(() => {
		const chatId = chat.conversationId;

		console.log('Pop-out toggle clicked:', {
			chatId,
			isSelectedChat,
			isPopOut,
			selectedChatId,
			popOutChats
		});

		if (isSelectedChat) {
			// If this chat is currently selected (whether popped out or not), close/deselect it
			console.log('Closing chat - is selected');
			if (isPopOut && onPopOutToggle) {
				// Remove from pop-out array if it's popped out
				console.log('Removing from popOutChats');
				onPopOutToggle(chatId);
			}
			// Always deselect when closing
			console.log('Setting selectedChat to null');
			setSelectedChat(null);
		} else {
			// If not selected, pop it out (if not already) and select it
			console.log('Opening chat - not selected');
			if (!isPopOut && onPopOutToggle) {
				console.log('Adding to popOutChats');
				onPopOutToggle(chatId);
			}
			console.log('Setting selectedChat to:', chatId);
			setSelectedChat(chatId);
		}
	}, [chat.conversationId, isPopOut, isSelectedChat, selectedChatId, popOutChats, onPopOutToggle, setSelectedChat]);

	const chatName = getChatName(chat);
	const chatAvatar = getChatAvatar(chat);
	const messageTypeIcon = getMessageTypeIcon();
	const statusIcon = getMessageStatusIcon();
	const isDirect = chat.type === 'direct';
	const isOnlineStatus = isOnline();
	const isTypingStatus = isTyping();
	const lastMessageContent = getLastMessageContent();

	return (
		<ContextMenu>
			<ContextMenuTrigger>
				<div
					className="relative group"
					onMouseEnter={() => setHoveredChat(chat.conversationId)}
					onMouseLeave={() => setHoveredChat(null)}
				>
					<div
						onClick={() => onSelect(chat.conversationId)}
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
										{isOnlineStatus && (
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
                    ${isTypingStatus
											? 'text-emerald-600 dark:text-emerald-400 italic font-medium'
											: isSelectedChat || isSelected
												? 'text-blue-700 dark:text-blue-200'
												: 'text-gray-600 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-slate-300'
										}`}>
										{isTypingStatus ? (
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
												<span>{lastMessageContent}</span>
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
			</ContextMenuTrigger>

			<ContextMenuContent className="w-56 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
				<ContextMenuItem
					onClick={() => console.log('Mark as unread')}
					className="cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-700/80 focus:bg-gray-100/80 dark:focus:bg-gray-700/80"
				>
					<MessageCircleMore className="w-4 h-4 mr-2" />
					Mark as unread
				</ContextMenuItem>

				<ContextMenuItem
					onClick={() => console.log('Pin to top')}
					className="cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-700/80 focus:bg-gray-100/80 dark:focus:bg-gray-700/80"
				>
					<Pin className="w-4 h-4 mr-2" />
					Pin to top
				</ContextMenuItem>

				<ContextMenuItem
					onClick={() => console.log('Add to favorites')}
					className="cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-700/80 focus:bg-gray-100/80 dark:focus:bg-gray-700/80"
				>
					<Star className="w-4 h-4 mr-2" />
					Add to favorites
				</ContextMenuItem>

				<ContextMenuItem
					onClick={() => console.log('Mute')}
					className="cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-700/80 focus:bg-gray-100/80 dark:focus:bg-gray-700/80"
				>
					<VolumeX className="w-4 h-4 mr-2" />
					Mute
				</ContextMenuItem>

				<ContextMenuSeparator className="bg-gray-200 dark:bg-gray-700" />

				<ContextMenuItem
					onClick={() => console.log('Archive chat')}
					className="cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-700/80 focus:bg-gray-100/80 dark:focus:bg-gray-700/80"
				>
					<Archive className="w-4 h-4 mr-2" />
					Archive
				</ContextMenuItem>

				<ContextMenuItem
					onClick={() => console.log('Clear messages')}
					className="cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-700/80 focus:bg-gray-100/80 dark:focus:bg-gray-700/80"
				>
					<Trash2 className="w-4 h-4 mr-2" />
					Clear messages
				</ContextMenuItem>

				<ContextMenuItem
					onClick={() => console.log('Delete chat')}
					className="cursor-pointer hover:bg-red-50/80 dark:hover:bg-red-900/20 focus:bg-red-50/80 dark:focus:bg-red-900/20 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
				>
					<Trash2 className="w-4 h-4 mr-2" />
					Delete
				</ContextMenuItem>

				<ContextMenuSeparator className="bg-gray-200 dark:bg-gray-700" />

				<ContextMenuItem
					onClick={handlePopOutToggle}
					className="cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-700/80 focus:bg-gray-100/80 dark:focus:bg-gray-700/80"
				>
					{isSelectedChat ? (
						<>
							<X className="w-4 h-4 mr-2" />
							Close chat
						</>
					) : (
						<>
							<ExternalLink className="w-4 h-4 mr-2" />
							Pop-out chat
						</>
					)}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
};

export default ChatItem;