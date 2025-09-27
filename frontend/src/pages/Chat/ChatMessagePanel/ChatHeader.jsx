import React from 'react';
import {
	MoreVertical,
	Phone,
	Video,
	Search,
} from 'lucide-react';
import { getInitials, getAvatarGradient } from '@/utils/helpers';

function ChatHeader({
	selectedChat,
	chatName,
	chatAvatar,
	isUserOnline,
	isGroupChat,
	isTyping,
	isMobile
}) {
	return (
		<div className="px-4 py-3 sm:py-4 flex items-center bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
			<div className="flex items-center flex-1 min-w-0">
				{/* Avatar */}
				<div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full mr-3 flex-shrink-0 overflow-hidden bg-gradient-to-br ${getAvatarGradient(selectedChat?.conversationId || selectedChat?.id || chatName)} relative`}>
					{chatAvatar ? (
						<img
							src={chatAvatar}
							alt={chatName}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center text-white font-semibold text-sm">
							{getInitials(chatName)}
						</div>
					)}
					{/* Online indicator - only for direct messages */}
					{selectedChat?.type === 'direct' && isUserOnline && (
						<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
					)}
				</div>

				{/* User info */}
				<div className="flex-1 min-w-0">
					<h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
						{chatName}
					</h3>
					<p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
						{isGroupChat ?
							`${selectedChat?.memberCount || selectedChat?.participants?.length || '0'} members` :
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
						{selectedChat?.type === 'direct' && (
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
	);
}

export default ChatHeader;