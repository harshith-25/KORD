import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Check, CheckCheck, Clock, AlertCircle, Reply, Edit2, Copy, Forward, Trash2, Info, Smile } from 'lucide-react';
import { formatTimeSafe } from '@/utils/helpers';
import QuickReactions from './QuickReactions';

function MessageBubble({
	message,
	currentUser,
	isGroupChat,
	isLastInGroup,
	selectedChat,
	contacts,
	onReply,
	onEdit,
	onDelete,
	onForward,
	onCopy,
	onReaction,
	onInfo,
	onRetry,
	onLongPress,
	isMobile,
	isBeingEdited,
	isHighlighted,
	onScrollToReply
}) {
	const [showMenu, setShowMenu] = useState(false);
	const [showReactionPicker, setShowReactionPicker] = useState(false);
	const menuRef = useRef(null);
	const longPressTimer = useRef(null);

	const isSentByMe = (message.senderId || message.sender?._id)?.toString() === currentUser?._id?.toString();
	const status = message.status || message.deliveryStatus || 'sent';
	const isDeleted = message.isDeleted || false;
	const isEdited = message.isEdited || false;
	const messageId = message._id || message.id;

	// Check if message has a reply - Handle both metadata.replyTo and direct replyTo
	const replyTo = message.replyTo;
	const hasReply = !!replyTo;

	// Close menu when clicking outside
	useEffect(() => {
		function handleClickOutside(event) {
			if (menuRef.current && !menuRef.current.contains(event.target)) {
				setShowMenu(false);
				setShowReactionPicker(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// Long press handlers for mobile
	const handleTouchStart = () => {
		if (isMobile) {
			longPressTimer.current = setTimeout(() => {
				setShowMenu(true);
			}, 500);
		}
	};

	const handleTouchEnd = () => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
		}
	};

	// Handle right-click context menu
	const handleContextMenu = (e) => {
		e.preventDefault();
		if (!isMobile) {
			setShowMenu(true);
		}
	};

	// Get user reactions
	const myReactions = (message.reactions || []).filter(
		r => (r.user?._id || r.user)?.toString() === currentUser?._id?.toString()
	);

	const hasReacted = (emoji) => {
		return myReactions.some(r => r.emoji === emoji);
	};

	// Status icon component
	const StatusIcon = () => {
		if (!isSentByMe || isDeleted) return null;

		switch (status) {
			case 'sending':
				return <Clock className="w-3 h-3 text-gray-400" />;
			case 'sent':
				return <Check className="w-3 h-3 text-gray-400" />;
			case 'delivered':
				return <CheckCheck className="w-3 h-3 text-gray-400" />;
			case 'read':
				return <CheckCheck className="w-3 h-3 text-blue-500" />;
			case 'failed':
				return <AlertCircle className="w-3 h-3 text-red-500" />;
			default:
				return <Check className="w-3 h-3 text-gray-400" />;
		}
	};

	// Menu options
	const menuOptions = [
		{ icon: Reply, label: 'Reply', action: () => onReply?.(message), show: !isDeleted },
		{
			icon: Edit2,
			label: 'Edit',
			action: () => onEdit?.(message),
			show: isSentByMe && !isDeleted
		},
		{ icon: Copy, label: 'Copy', action: () => onCopy?.(message), show: !isDeleted },
		{ icon: Forward, label: 'Forward', action: () => onForward?.(message), show: !isDeleted },
		{
			icon: Trash2,
			label: 'Delete for me',
			action: () => onDelete?.(message, false),
			show: true,
			className: 'text-red-500'
		},
		{
			icon: Trash2,
			label: 'Delete for everyone',
			action: () => onDelete?.(message, true),
			show: isSentByMe && !isDeleted,
			className: 'text-red-600 font-semibold'
		},
		{ icon: Info, label: 'Info', action: () => onInfo?.(message), show: true },
	].filter(option => option.show);

	const handleMenuOptionClick = (action) => {
		action();
		setShowMenu(false);
		setShowReactionPicker(false);
	};

	// Handle reply click - scroll to original message
	const handleReplyClick = () => {
		if (replyTo?.messageId && onScrollToReply) {
			console.log('🔗 Clicking reply, navigating to message:', replyTo.messageId);
			onScrollToReply(replyTo.messageId);
		} else if (replyTo?._id && onScrollToReply) {
			console.log('🔗 Clicking reply, navigating to message:', replyTo._id);
			onScrollToReply(replyTo._id);
		} else {
			console.warn('⚠️ Reply click failed - no messageId or _id found', replyTo);
		}
	};

	// Determine if the replied message was deleted
	const isRepliedMessageDeleted = replyTo?.isDeleted || false;

	// Get sender name for reply preview
	const getReplySenderName = () => {
		if (!replyTo) return 'Replying to User';

		// Check if the replied-to message was sent by current user
		const repliedMessageSenderId = (replyTo.senderId || replyTo.sender?._id)?.toString();
		const isRepliedToMyMessage = repliedMessageSenderId === currentUser?._id?.toString();

		// If I sent this reply (I'm the one replying)
		if (isSentByMe) {
			// If I'm replying to my own message
			if (isRepliedToMyMessage) {
				return 'Replying to yourself';
			}
			// If I'm replying to someone else's message - show their name
			// Fall through to name logic below
		} else {
			// If someone else sent this reply, always show who they replied to
			// If they replied to me, show "You"
			if (isRepliedToMyMessage) {
				return 'Replying to You';
			}
			// Otherwise show the original sender's name - fall through
		}

		// Get the actual sender's name for "replying to [their name]" cases
		let senderName = 'User';

		// Check for senderName field first (from backend)
		if (replyTo.senderName) {
			senderName = replyTo.senderName.trim() || 'User';
		}
		// Fallback to constructing from sender object
		else if (replyTo.sender) {
			if (replyTo.sender.firstName) {
				senderName = `${replyTo.sender.firstName} ${replyTo.sender.lastName || ''}`.trim();
			} else if (replyTo.sender.name) {
				senderName = replyTo.sender.name;
			} else if (replyTo.sender.username) {
				senderName = replyTo.sender.username;
			}
		}

		return `Replying to ${senderName}`;
	};

	return (
		<div
			className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} relative`}
			onTouchStart={handleTouchStart}
			onTouchEnd={handleTouchEnd}
		>
			{/* Avatar for received messages in group chat */}
			{!isSentByMe && isGroupChat && isLastInGroup && (
				<div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 mr-2 flex-shrink-0 overflow-hidden">
					{message.sender?.image || message.sender?.avatar ? (
						<img
							src={message.sender.image || message.sender.avatar}
							alt=""
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300">
							{(message.sender?.firstName?.[0] || message.sender?.name?.[0] || '?').toUpperCase()}
						</div>
					)}
				</div>
			)}
			{!isSentByMe && isGroupChat && !isLastInGroup && (
				<div className="w-8 mr-2 flex-shrink-0" />
			)}

			<div className="flex items-end gap-1 max-w-[75%] sm:max-w-[65%] relative group">
				{/* Desktop hover menu - only shows when hovering over bubble */}
				{!isMobile && (
					<div className={`absolute ${isSentByMe ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10`}>
						<button
							onClick={() => onReply?.(message)}
							className="p-1.5 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
							title="Reply"
							disabled={isDeleted}
						>
							<Reply className="w-4 h-4 text-gray-600 dark:text-gray-300" />
						</button>
						{!isDeleted && (
							<button
								onClick={() => setShowReactionPicker(!showReactionPicker)}
								className="p-1.5 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
								title="React"
							>
								<Smile className="w-4 h-4 text-gray-600 dark:text-gray-300" />
							</button>
						)}
						<button
							onClick={() => setShowMenu(!showMenu)}
							className="p-1.5 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
							title="More"
						>
							<MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-300" />
						</button>
					</div>
				)}

				{/* Reaction picker - Using QuickReactions Component */}
				{showReactionPicker && !isDeleted && (
					<QuickReactions
						message={message}
						currentUser={currentUser}
						showQuickReactions={showReactionPicker}
						isCurrentUserMessage={isSentByMe}
						onReaction={(msgId, emoji, hasReacted) => {
							onReaction?.(msgId, emoji, hasReacted);
							setShowReactionPicker(false);
						}}
						onClose={() => setShowReactionPicker(false)}
						pickerOnly={true}
					/>
				)}

				{/* Context menu */}
				{showMenu && (
					<div
						className={`absolute ${isSentByMe ? 'right-0' : 'left-0'} bottom-full mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[200px]`}
						ref={menuRef}
					>
						{menuOptions.map((option, index) => (
							<button
								key={index}
								onClick={() => handleMenuOptionClick(option.action)}
								className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left ${option.className || 'text-gray-700 dark:text-gray-300'
									}`}
							>
								<option.icon className="w-4 h-4" />
								<span className="text-sm">{option.label}</span>
							</button>
						))}
					</div>
				)}

				{/* Message bubble */}
				<div
					onContextMenu={handleContextMenu}
					className={`
						relative rounded-2xl px-3 py-2 shadow-sm transition-all
						${isSentByMe
							? 'bg-green-500 text-white rounded-br-md'
							: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-200 dark:border-gray-700'
						}
						${isBeingEdited ? 'ring-2 ring-amber-400 ring-offset-2' : ''}
						${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2 animate-pulse' : ''}
						${status === 'failed' ? 'opacity-70' : ''}
					`}
				>
					{/* Reply preview - clickable to scroll to original */}
					{hasReply && !isDeleted && (
						<div
							onClick={handleReplyClick}
							className={`mb-2 pb-2 border-l-4 pl-2 cursor-pointer hover:opacity-80 transition-opacity ${isSentByMe
								? 'border-white/50 bg-white/10 hover:bg-white/20'
								: 'border-green-500 dark:border-green-400 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
								} rounded-r p-2 -mx-1`}
						>
							<div className="flex items-center gap-1 mb-1">
								<Reply className={`w-3 h-3 ${isSentByMe ? 'text-white/90' : 'text-green-500 dark:text-green-400'}`} />
								<p className={`text-xs font-semibold ${isSentByMe ? 'text-white/90' : 'text-green-600 dark:text-green-400'
									}`}>
									{getReplySenderName()}
								</p>
							</div>
							{isRepliedMessageDeleted ? (
								<p className={`text-xs italic ${isSentByMe ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'
									}`}>
									<Trash2 className="w-3 h-3 inline mr-1" />
									Message was deleted
								</p>
							) : (
								<p className={`text-xs line-clamp-2 ${isSentByMe ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
									}`}>
									{replyTo.content || 'Message'}
								</p>
							)}
						</div>
					)}

					{/* Message content */}
					{isDeleted ? (
						<div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 italic text-sm">
							<Trash2 className="w-3 h-3" />
							<span>This message was deleted</span>
						</div>
					) : (
						<>
							{/* Media attachments */}
							{message.file && (
								<div className="mb-2">
									{message.file.fileType?.startsWith('image') || message.file.fileMimeType?.startsWith('image') ? (
										<img
											src={message.file.filePath}
											alt="Attachment"
											className="rounded-lg max-w-full h-auto max-h-80 object-cover"
										/>
									) : message.file.fileType?.startsWith('video') || message.file.fileMimeType?.startsWith('video') ? (
										<video
											src={message.file.filePath}
											controls
											className="rounded-lg max-w-full max-h-80"
										/>
									) : (
										<a
											href={message.file.filePath}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-2 p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
										>
											<span className="text-sm">{message.file.fileName || 'File'}</span>
										</a>
									)}
								</div>
							)}

							{/* Text content */}
							{(message.content || message.text) && (
								<p className="text-sm whitespace-pre-wrap break-words">
									{message.content || message.text}
								</p>
							)}
						</>
					)}

					{/* Message footer - time, status, edited indicator */}
					<div className="flex items-center justify-end gap-1 mt-1">
						{isEdited && !isDeleted && (
							<span className={`text-xs italic ${isSentByMe ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
								}`}>
								edited
							</span>
						)}
						<span className={`text-xs ${isSentByMe ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
							}`}>
							{formatTimeSafe(message.time || message.createdAt)}
						</span>
						<StatusIcon />
					</div>

					{/* Reactions display */}
					{message.reactions && message.reactions.length > 0 && (
						<div className="absolute -bottom-3 right-2 flex gap-1">
							{Object.entries(
								message.reactions.reduce((acc, r) => {
									acc[r.emoji] = (acc[r.emoji] || 0) + 1;
									return acc;
								}, {})
							).map(([emoji, count]) => (
								<div
									key={emoji}
									className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-0.5 shadow-sm cursor-pointer hover:scale-110 transition-transform"
									onClick={() => onReaction?.(messageId, emoji, hasReacted(emoji))}
								>
									<span>{emoji}</span>
									{count > 1 && <span className="text-gray-600 dark:text-gray-400">{count}</span>}
								</div>
							))}
						</div>
					)}

					{/* Retry button for failed messages */}
					{status === 'failed' && isSentByMe && (
						<button
							onClick={() => onRetry?.(messageId, message.conversationId)}
							className="absolute -bottom-6 right-0 text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium"
						>
							<AlertCircle className="w-3 h-3" />
							<span>Tap to retry</span>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

export default MessageBubble;