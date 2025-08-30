import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
	MessageCircleHeart,
	Paperclip,
	Send,
	Smile,
	Loader2,
	MoreVertical,
	Phone,
	Video,
	Search,
	ArrowDown,
	Check,
	CheckCheck,
	Clock
} from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import {
	formatTimeSafe,
	formatDateSeparator,
	isSameDaySafe,
	shouldGroupMessage,
	getInitials,
	isGroupOrChannel,
	getMessageDisplayName,
	getMessageAvatar,
	isValidMessage,
	getMessageContent,
	getAvatarGradient
} from '@/utils/helpers';

function ChatMainPanel() {
	const {
		selectedChatId,
		contacts,
		messages,
		fetchMessages,
		sendMessage,
		loadingMessages,
		isTyping,
		onlineUsers
	} = useChatStore();

	const selectedChat = contacts.find(contact => contact.id === selectedChatId);
	const currentMessages = messages[selectedChatId] || [];
	const messagesEndRef = useRef(null);
	const messagesContainerRef = useRef(null);
	const inputRef = useRef(null);

	// Component state
	const [messageInput, setMessageInput] = useState('');
	const [showScrollButton, setShowScrollButton] = useState(false);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);

	// Check if current chat is group or channel
	const isGroupChat = isGroupOrChannel(selectedChat);

	// Responsive handling
	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth < 768);
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	// Fetch messages when chat changes
	useEffect(() => {
		if (selectedChatId) {
			fetchMessages(selectedChatId);
		}
	}, [selectedChatId, fetchMessages]);

	// Scroll handling
	const scrollToBottom = useCallback((behavior = 'smooth') => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior });
		}
	}, []);

	const handleScroll = useCallback(() => {
		if (!messagesContainerRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
		const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

		setIsAtBottom(isNearBottom);
		setShowScrollButton(!isNearBottom && currentMessages.length > 0);
	}, [currentMessages.length]);

	// Auto-scroll when messages change
	useEffect(() => {
		if (isAtBottom) {
			scrollToBottom('smooth');
		}
	}, [currentMessages, isAtBottom, scrollToBottom]);

	// Initial scroll to bottom
	useEffect(() => {
		if (currentMessages.length > 0) {
			scrollToBottom('auto');
		}
	}, [selectedChatId]);

	// Message sending
	const handleSendMessage = useCallback((e) => {
		e.preventDefault();
		if (messageInput.trim() && selectedChatId) {
			sendMessage(selectedChatId, messageInput.trim());
			setMessageInput('');

			// Focus input on mobile after sending
			if (isMobile && inputRef.current) {
				inputRef.current.focus();
			}
		}
	}, [messageInput, selectedChatId, sendMessage, isMobile]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e) => {
			// Ctrl/Cmd + K to focus input
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				inputRef.current?.focus();
			}

			// Escape to close emoji picker
			if (e.key === 'Escape' && showEmojiPicker) {
				setShowEmojiPicker(false);
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [showEmojiPicker]);

	// Message status icons
	const getMessageStatusIcon = (message) => {
		if (message.type !== 'sent') return null;

		switch (message.status) {
			case 'sending':
				return <Clock className="h-3 w-3 opacity-60" />;
			case 'sent':
				return <Check className="h-3 w-3 opacity-60" />;
			case 'delivered':
				return <CheckCheck className="h-3 w-3 opacity-60" />;
			case 'read':
				return <Clock className="h-3 w-3 text-white opacity-80" />;
			default:
				return <Clock className="h-3 w-3 opacity-60" />;
		}
	};

	// Check if user is online
	const isUserOnline = selectedChat && onlineUsers?.includes(selectedChat.id);

	// Render message avatar for groups
	const renderMessageAvatar = (message, isLastInGroup) => {
		if (!isGroupChat) return null;

		const avatarInfo = getMessageAvatar(message, selectedChat, contacts);
		if (!avatarInfo) return null;

		return (
			<div className={`w-8 h-8 rounded-full mr-2 flex-shrink-0 overflow-hidden bg-gradient-to-br ${getAvatarGradient(message.senderId)} ${!isLastInGroup ? 'opacity-0' : ''}`}>
				{avatarInfo.src ? (
					<img
						src={avatarInfo.src}
						alt={avatarInfo.name}
						className="w-full h-full object-cover"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-white font-semibold text-xs">
						{getInitials(avatarInfo.name)}
					</div>
				)}
			</div>
		);
	};

	// Render message sender name for groups
	const renderSenderName = (message, isGrouped) => {
		if (!isGroupChat || isGrouped) return null;

		const displayName = getMessageDisplayName(message, selectedChat, contacts);
		if (!displayName) return null;

		return (
			<div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 ml-10">
				{displayName}
			</div>
		);
	};

	if (!selectedChatId) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900">
				<MessageCircleHeart className="w-24 h-24 sm:w-32 sm:h-32 mb-6 text-gray-400 dark:text-gray-600" strokeWidth={1} />
				<h2 className="text-2xl sm:text-3xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
					Kord for Web
				</h2>
				<p className="max-w-sm text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
					Send and receive messages without keeping your phone online.
					Use Kord on up to 4 linked devices and 1 phone at the same time.
				</p>
				<div className="mt-8 text-xs sm:text-sm">
					<span className="inline-flex items-center text-gray-500 dark:text-gray-500">
						<MessageCircleHeart className="h-4 w-4 mr-1" />
						End-to-end encrypted
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col h-full relative">
			{/* Chat Header */}
			<div className="px-4 py-3 sm:py-4 flex items-center bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div className="flex items-center flex-1 min-w-0">
					{/* Avatar */}
					<div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full mr-3 flex-shrink-0 overflow-hidden bg-gradient-to-br ${getAvatarGradient(selectedChat?.id || selectedChat?.name)} relative`}>
						{selectedChat?.avatar ? (
							<img
								src={selectedChat.avatar}
								alt={selectedChat.name}
								className="w-full h-full object-cover"
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center text-white font-semibold text-sm">
								{getInitials(selectedChat?.name)}
							</div>
						)}
						{/* Online indicator - only for direct messages */}
						{!isGroupChat && isUserOnline && (
							<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
						)}
					</div>

					{/* User info */}
					<div className="flex-1 min-w-0">
						<h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
							{selectedChat?.name}
						</h3>
						<p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
							{isGroupChat ?
								`${selectedChat?.memberCount || '0'} members` :
								isUserOnline ? 'Online' : isTyping ? 'Typing...' : 'Last seen recently'
							}
						</p>
					</div>
				</div>

				{/* Header actions */}
				<div className="flex items-center space-x-1 sm:space-x-2 ml-2">
					{!isMobile && (
						<>
							<button
								className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								title="Search in chat"
							>
								<Search className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
							{!isGroupChat && (
								<>
									<button
										className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
										title="Voice call"
									>
										<Phone className="h-5 w-5 text-gray-600 dark:text-gray-300" />
									</button>
									<button
										className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
										title="Video call"
									>
										<Video className="h-5 w-5 text-gray-600 dark:text-gray-300" />
									</button>
								</>
							)}
						</>
					)}
					<button
						className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						title="More options"
					>
						<MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-300" />
					</button>
				</div>
			</div>

			{/* Messages Area */}
			<div
				ref={messagesContainerRef}
				onScroll={handleScroll}
				className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50 dark:bg-gray-900 custom-scrollbar"
				style={{
					backgroundImage: isMobile ? 'none' : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f0f0f0' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
				}}
			>
				{loadingMessages ? (
					<div className="flex flex-col items-center justify-center h-full">
						<Loader2 className="w-8 h-8 animate-spin mb-2 text-gray-400" />
						<p className="text-gray-500 dark:text-gray-400">Loading messages...</p>
					</div>
				) : currentMessages.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<p className="text-gray-500 dark:text-gray-400">No messages yet. Say hello! 👋</p>
					</div>
				) : (
					<div className="space-y-1">
						{currentMessages.map((message, index) => {
							// Validate message
							if (!isValidMessage(message, index)) return null;

							const prevMessage = currentMessages[index - 1];
							const nextMessage = currentMessages[index + 1];

							const isGrouped = shouldGroupMessage(message, prevMessage);
							const isLastInGroup = !shouldGroupMessage(nextMessage, message);

							const showDate = !prevMessage || !isSameDaySafe(message.time, prevMessage.time);

							return (
								<React.Fragment key={message.id || `message-${index}`}>
									{/* Date separator */}
									{showDate && message.time && (
										<div className="flex justify-center my-4">
											<span className="px-3 py-1 bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
												{formatDateSeparator(message.time)}
											</span>
										</div>
									)}

									{/* Sender name for groups */}
									{renderSenderName(message, isGrouped)}

									{/* Message */}
									<div className={`flex ${message.type === 'sent' ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-1' : 'mt-2'}`}>
										{/* Avatar for received messages in groups */}
										{message.type === 'received' && renderMessageAvatar(message, isLastInGroup)}

										<div
											className={`max-w-[85%] sm:max-w-[70%] px-3 py-2 sm:px-4 sm:py-3 rounded-2xl shadow-sm relative ${message.type === 'sent'
												? `bg-green-500 text-white ${isLastInGroup ? 'rounded-br-md' : ''}`
												: `bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isLastInGroup ? 'rounded-bl-md' : ''}`
												} ${isMobile ? 'text-sm' : 'text-base'}`}
										>
											<p className="break-words whitespace-pre-wrap leading-relaxed">
												{getMessageContent(message)}
											</p>

											{/* Message metadata */}
											<div className={`flex items-center justify-end space-x-1 mt-1 ${message.type === 'sent'
												? 'text-green-100'
												: 'text-gray-500 dark:text-gray-400'
												}`}>
												<span className="text-xs">
													{formatTimeSafe(message.time)}
												</span>
												{message.type === 'sent' && (
													<div className="flex items-center">
														{getMessageStatusIcon(message)}
													</div>
												)}
											</div>
										</div>
									</div>
								</React.Fragment>
							);
						})}
						<div ref={messagesEndRef} />
					</div>
				)}
			</div>

			{/* Scroll to bottom button */}
			{showScrollButton && (
				<button
					onClick={scrollToBottom}
					className={`fixed z-10 w-12 h-12 bg-white dark:bg-gray-700 shadow-lg rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600 hover:shadow-xl transform hover:scale-105 transition-all duration-200 ${isMobile ? 'bottom-20 right-4' : 'bottom-24 right-6'
						}`}
					aria-label="Scroll to bottom"
				>
					<ArrowDown className="h-6 w-6 text-gray-600 dark:text-gray-300" />
				</button>
			)}

			{/* Typing Indicator */}
			{isTyping && (
				<div className="absolute bottom-16 left-4 right-4 flex items-center bg-white dark:bg-gray-700 rounded-lg px-3 py-2 shadow-md border border-gray-200 dark:border-gray-600">
					<div className="flex space-x-1 mr-2">
						<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
						<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
						<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
					</div>
					<span className="text-sm text-gray-600 dark:text-gray-300">
						{selectedChat?.name || 'Someone'} is typing...
					</span>
				</div>
			)}

			{/* Message Input Area */}
			<div className="relative">
				{/* Emoji Picker */}
				{showEmojiPicker && (
					<div className="absolute bottom-full left-0 right-0 mb-2 z-20">
						<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-4 max-h-64 overflow-y-auto">
							<div className="grid grid-cols-8 gap-2">
								{/* Basic emoji support */}
								{['😀', '😂', '🥰', '😍', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '💯', '😎'].map((emoji, index) => (
									<button
										key={index}
										type="button"
										onClick={() => {
											setMessageInput(prev => prev + emoji);
											setShowEmojiPicker(false);
										}}
										className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xl"
									>
										{emoji}
									</button>
								))}
							</div>
						</div>
					</div>
				)}

				{/* Message Input Form */}
				<form
					onSubmit={handleSendMessage}
					className="p-4 flex items-end space-x-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
				>
					{/* Emoji Button */}
					<button
						type="button"
						onClick={() => setShowEmojiPicker(!showEmojiPicker)}
						className={`p-2 rounded-full transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${showEmojiPicker ? 'bg-gray-100 dark:bg-gray-700' : ''
							}`}
						aria-label="Toggle emoji picker"
					>
						<Smile className="h-6 w-6 text-gray-500 dark:text-gray-400" />
					</button>

					{/* File Upload Button */}
					<div className="relative">
						<button
							type="button"
							onClick={() => {
								// File upload functionality can be implemented here
								console.log('File upload clicked');
							}}
							className="p-2 rounded-full transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
							aria-label="Attach file"
						>
							<Paperclip className="h-6 w-6 text-gray-500 dark:text-gray-400" />
						</button>
					</div>

					{/* Message Input */}
					<div className="flex-1 relative">
						<textarea
							ref={inputRef}
							value={messageInput}
							onChange={e => setMessageInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleSendMessage(e);
								}
							}}
							placeholder="Type a message"
							rows={1}
							className="w-full py-2 px-4 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200 resize-none bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-gray-600 max-h-32"
							style={{ minHeight: '40px' }}
							maxLength={1000}
						/>
						{messageInput.trim() && (
							<div className="absolute bottom-1 right-1 text-xs text-gray-400">
								{messageInput.length}/1000
							</div>
						)}
					</div>

					{/* Send Button */}
					{messageInput.trim() ? (
						<button
							type="submit"
							className="p-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95"
							aria-label="Send message"
						>
							<Send className="h-6 w-6" />
						</button>
					) : (
						<button
							type="button"
							onClick={() => {
								// Voice recording functionality can be implemented here
								console.log('Voice recording clicked');
							}}
							className="p-2 rounded-full transition-colors duration-200 transform active:scale-95 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
							aria-label="Hold to record voice message"
						>
							<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
							</svg>
						</button>
					)}
				</form>
			</div>
		</div>
	);
}

export default ChatMainPanel;