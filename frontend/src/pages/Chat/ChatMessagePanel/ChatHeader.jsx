import { MoreVertical, Phone, Video, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import Avatar from '@/components/Avatar';

function ChatHeader({
	selectedChat,
	chatName,
	chatAvatar,
	isUserOnline,
	isGroupChat,
	isTyping,
	isMobile,
}) {
	const [showLastSeen, setShowLastSeen] = useState(true);

	// Show last seen for only 5 seconds when component mounts or user goes offline
	useEffect(() => {
		if (!isUserOnline && selectedChat?.lastActivity) {
			setShowLastSeen(true);
			const timer = setTimeout(() => {
				setShowLastSeen(false);
			}, 5000);
			return () => clearTimeout(timer);
		}
	}, [isUserOnline, selectedChat?.lastActivity]);

	// Format last seen time
	const getLastSeenText = () => {
		if (isTyping) return 'Typing...';
		if (isUserOnline) return 'Online';

		if (!showLastSeen) return '';

		// Use selectedChat's lastActivity, not currentUser's
		if (selectedChat?.lastActivity) {
			try {
				const lastActivityDate = new Date(selectedChat.lastActivity);
				if (!isNaN(lastActivityDate.getTime())) {
					const now = new Date();
					const diffInMs = now - lastActivityDate;
					const diffInMinutes = Math.floor(diffInMs / 60000);
					const diffInHours = Math.floor(diffInMinutes / 60);
					const diffInDays = Math.floor(diffInHours / 24);

					if (diffInMinutes < 1) return 'Last seen just now';
					if (diffInMinutes < 60) return `Last seen ${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
					if (diffInHours < 24) return `Last seen ${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
					if (diffInDays < 7) return `Last seen ${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;

					return `Last seen ${lastActivityDate.toLocaleDateString()}`;
				}
			} catch (error) {
				console.error('Error formatting last seen:', error);
			}
		}

		return '';
	};

	const lastSeenText = getLastSeenText();
	const isOnlineNow = isUserOnline && !isTyping;

	return (
		<div className="px-3 py-2 sm:px-4 sm:py-2.5 flex items-center bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
			<div className="flex items-center flex-1 min-w-0">
				{/* Avatar with online indicator */}
				<div className="mr-2.5 sm:mr-3">
					<Avatar
						src={chatAvatar}
						name={chatName}
						id={selectedChat?.conversationId || selectedChat?.id || chatName}
						size={isMobile ? 'sm' : 'md'}
						showOnline={selectedChat?.type === 'direct'}
						isOnline={isUserOnline}
					/>
				</div>

				{/* User info */}
				<div className="flex-1 min-w-0">
					<h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
						{chatName}
					</h3>
					{(lastSeenText || isGroupChat) && (
						<p className={`text-xs sm:text-sm truncate leading-tight mt-0.5 ${isOnlineNow
							? 'text-green-600 dark:text-green-400 font-semibold'
							: isTyping
								? 'text-blue-600 dark:text-blue-400 font-medium'
								: 'text-gray-500 dark:text-gray-400'
							}`}>
							{isGroupChat
								? `${selectedChat?.memberCount || selectedChat?.participants?.length || '0'} members`
								: lastSeenText
							}
						</p>
					)}
				</div>
			</div>

			{/* Header actions */}
			<div className="flex items-center space-x-0.5 sm:space-x-1 ml-2">
				{!isMobile && (
					<>
						<button
							className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							title="Search in chat"
						>
							<Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
						</button>
						{selectedChat?.type === 'direct' && (
							<>
								<button
									className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
									title="Voice call"
								>
									<Phone className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
								</button>
								<button
									className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
									title="Video call"
								>
									<Video className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
								</button>
							</>
						)}
					</>
				)}
				<button
					className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					title="More options"
				>
					<MoreVertical className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
				</button>
			</div>
		</div>
	);
}

export default ChatHeader;