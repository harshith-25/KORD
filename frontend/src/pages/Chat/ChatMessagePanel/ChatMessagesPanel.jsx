import React from 'react';
import {
	Loader2,
	ArrowDown,
	Check,
	CheckCheck,
	Clock
} from 'lucide-react';
import {
	formatTimeSafe,
	formatDateSeparator,
	isSameDaySafe,
	shouldGroupMessage,
	getInitials,
	getMessageDisplayName,
	getMessageAvatar,
	isValidMessage,
	getMessageContent,
	getAvatarGradient
} from '@/utils/helpers';

function ChatMessagesPanel({
	currentMessages,
	currentUser,
	selectedChat,
	contacts,
	isGroupChat,
	loadingMessages,
	messagesContainerRef,
	messagesEndRef,
	handleScroll,
	scrollToBottom,
	showScrollButton,
	isTyping,
	chatName,
	isMobile
}) {
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
				return <CheckCheck className="h-3 w-3 text-white opacity-80" />;
			default:
				return <Clock className="h-3 w-3 opacity-60" />;
		}
	};

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

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<div
				ref={messagesContainerRef}
				onScroll={handleScroll}
				className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 bg-gray-50 dark:bg-gray-900 custom-scrollbar"
				style={{
					backgroundImage: isMobile ? 'none' : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f0f0f0' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
					minHeight: '0',
					maxHeight: '100%'
				}}
			>
				{loadingMessages ? (
					<div className="flex flex-col items-center justify-center h-full min-h-32">
						<Loader2 className="w-8 h-8 animate-spin mb-2 text-gray-400" />
						<p className="text-gray-500 dark:text-gray-400">Loading messages...</p>
					</div>
				) : currentMessages.length === 0 ? (
					<div className="flex items-center justify-center h-full min-h-32">
						<p className="text-gray-500 dark:text-gray-400">No messages yet. Say hello! 👋</p>
					</div>
				) : (
					<div className="space-y-1 pb-4">
						{currentMessages.map((message, index) => {
							if (!isValidMessage(message, index)) return null;

							const prevMessage = currentMessages[index - 1];
							const nextMessage = currentMessages[index + 1];

							const isGrouped = shouldGroupMessage(message, prevMessage);
							const isLastInGroup = !shouldGroupMessage(nextMessage, message);

							const isCurrentUserMessage = message.sender?._id === currentUser?._id ||
								message.sender === currentUser?._id ||
								message.senderId === currentUser?._id;

							const showDate = !prevMessage || !isSameDaySafe(message.time || message.createdAt, prevMessage.time || prevMessage.createdAt);

							return (
								<React.Fragment key={message.messageId || message.id || message._id || `message-${index}`}>
									{showDate && (message.time || message.createdAt) && (
										<div className="flex justify-center my-4">
											<span className="px-3 py-1 bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
												{formatDateSeparator(message.time || message.createdAt)}
											</span>
										</div>
									)}

									{renderSenderName(message, isGrouped)}

									<div className={`flex ${message.type === 'sent' ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-1' : 'mt-2'}`}>
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

											<div className={`flex items-center justify-end space-x-1 mt-1 ${message.type === 'sent'
												? 'text-green-100'
												: 'text-gray-500 dark:text-gray-400'
												}`}>
												<span className="text-xs">
													{formatTimeSafe(message.time || message.createdAt)}
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

						{/* Typing Indicator - Moved inside messages container as regular element */}
						{isTyping && (
							<div className="flex justify-start mt-2">
								<div className="flex items-center bg-white dark:bg-gray-700 rounded-lg px-3 py-2 shadow-md border border-gray-200 dark:border-gray-600 max-w-xs">
									<div className="flex space-x-1 mr-2">
										<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
										<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
										<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
									</div>
									<span className="text-sm text-gray-600 dark:text-gray-300">
										{chatName} is typing...
									</span>
								</div>
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>
				)}
			</div>

			{/* Scroll to bottom button - Positioned at bottom center */}
			{showScrollButton && (
				<button
					onClick={() => scrollToBottom('smooth')}
					className="absolute z-10 w-12 h-12 bg-white dark:bg-gray-700 shadow-lg rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600 hover:shadow-xl transform hover:scale-105 transition-all duration-200 bottom-21 left-1/2 -translate-x-1/2"
					aria-label="Scroll to bottom"
				>
					<ArrowDown className="h-6 w-6 text-gray-600 dark:text-gray-300" />
				</button>
			)}
		</div>
	);
}

export default ChatMessagesPanel;