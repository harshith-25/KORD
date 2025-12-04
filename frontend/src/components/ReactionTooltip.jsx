import { memo, useState, useRef, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BottomSheet } from '@/components/ui/bottom-sheet';

/**
 * ReactionTooltip - Shows list of users who reacted with which emojis
 * @param {Object} props
 * @param {Array} props.reactions - Array of reaction objects from the message
 * @param {string} props.currentUserId - ID of the current user for highlighting
 * @param {boolean} props.isMobile - Whether the device is mobile (for touch interactions)
 * @param {string} props.messageId - Id of message for reaction toggles
 * @param {function} props.onToggleEmoji - Handler when user toggles an emoji reaction
 * @param {React.ReactNode} props.children - Trigger element (reaction badge container)
 */
function ReactionTooltip({ reactions, currentUserId, isMobile, children, messageId, onToggleEmoji }) {
	const [open, setOpen] = useState(false);
	const [longPressTriggered, setLongPressTriggered] = useState(false);
	const longPressTimer = useRef(null);
	const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

	if (!reactions || reactions.length === 0) {
		return children;
	}

	// Process reactions to get a list of users and their emojis
	const userReactions = reactions.map(reaction => ({
		user: reaction.user,
		emojis: reaction.emojis || [],
		reactedAt: reaction.reactedAt
	}));

	const totalReactions = userReactions.reduce((acc, curr) => acc + curr.emojis.length, 0);

	const emojiGroups = useMemo(() => {
		const groups = {};
		userReactions.forEach(item => {
			(item.emojis || []).forEach(emoji => {
				if (!groups[emoji]) {
					groups[emoji] = [];
				}
				groups[emoji].push(item.user);
			});
		});
		return groups;
	}, [userReactions]);

	const currentUserEmojiSet = useMemo(() => {
		const myEntry = reactions.find(
			react => (react.user?._id || react.user)?.toString() === currentUserId?.toString()
		);
		return new Set(myEntry?.emojis || []);
	}, [reactions, currentUserId]);

	const handleEmojiToggle = (emoji) => {
		if (!onToggleEmoji || !messageId) return;
		const hasReacted = currentUserEmojiSet.has(emoji);
		onToggleEmoji(messageId, emoji, hasReacted);
	};

	const getInitials = (user) => {
		if (!user) return '?';
		if (user.firstName && user.lastName) {
			return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
		}
		if (user.firstName) return user.firstName[0].toUpperCase();
		if (user.name) return user.name[0].toUpperCase();
		if (user.username) return user.username[0].toUpperCase();
		return '?';
	};

	const getUserDisplayName = (user) => {
		if (!user) return 'Unknown User';
		if (user.firstName && user.lastName) {
			return `${user.firstName} ${user.lastName}`;
		}
		if (user.firstName) return user.firstName;
		if (user.name) return user.name;
		if (user.username) return user.username;
		return 'Unknown User';
	};

	const formatTime = (dateString) => {
		if (!dateString) return '';
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	};

	// Touch event handlers for mobile long-press
	const handleTouchStart = (e) => {
		if (!isMobile) return;

		longPressTimer.current = setTimeout(() => {
			setOpen(true);
			setLongPressTriggered(true);
		}, 500);
	};

	const handleTouchEnd = (e) => {
		if (!isMobile) return;

		// Clear the timer if user releases before 500ms
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
		}

		// If tooltip was shown via long-press, prevent click from toggling reaction
		if (longPressTriggered) {
			e.preventDefault();
			e.stopPropagation();
			setLongPressTriggered(false);
			// Close tooltip after a brief delay
			setTimeout(() => setOpen(false), 2000);
		}
	};

	const handleTouchMove = () => {
		// Cancel long-press if user scrolls
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
		}
	};

	// Mouse event handlers for desktop hover
	const handleMouseEnter = () => {
		if (!isMobile) {
			setOpen(true);
		}
	};

	const handleMouseLeave = () => {
		if (!isMobile) {
			setOpen(false);
		}
	};

	if (isMobile) {
		return (
			<>
				<div
					onTouchStart={handleTouchStart}
					onTouchEnd={handleTouchEnd}
					onTouchMove={handleTouchMove}
					onClick={() => setMobileSheetOpen(true)}
					className="cursor-pointer"
				>
					{children}
				</div>
				<BottomSheet
					open={mobileSheetOpen}
					onOpenChange={setMobileSheetOpen}
					snapPoint="half"
					title="Reactions"
					description={`${totalReactions} ${totalReactions === 1 ? 'reaction' : 'reactions'}`}
				>
					<div className="p-4 space-y-4">
						<div className="flex flex-wrap gap-2">
							{Object.entries(emojiGroups).map(([emoji, users]) => {
								const hasReacted = users.some((user) => (user?._id || user)?.toString() === currentUserId?.toString());
								return (
									<button
										key={emoji}
										onClick={() => handleEmojiToggle(emoji)}
										className={`px-3 py-1 rounded-full border flex items-center gap-2 text-sm ${hasReacted ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-700'}`}
									>
										<span>{emoji}</span>
										{users.length > 1 && <span className="text-xs text-gray-500">{users.length}</span>}
									</button>
								);
							})}
						</div>
						<ScrollArea className="max-h-72">
							<div className="space-y-2">
								{userReactions.map((item, index) => {
									const isCurrentUser = (item.user?._id || item.user)?.toString() === currentUserId?.toString();

									return (
										<div
											key={`${item.user?._id || index}-${index}`}
											className={`flex items-center gap-3 px-2 py-2 rounded-md ${isCurrentUser ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}`}
										>
											<Avatar className="h-8 w-8 flex-shrink-0">
												<AvatarImage src={item.user?.image || item.user?.avatar} />
												<AvatarFallback className="bg-black dark:bg-white text-white dark:text-black text-xs">
													{getInitials(item.user)}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-black dark:text-white' : 'text-gray-900 dark:text-gray-100'}`}>
														{isCurrentUser ? 'You' : getUserDisplayName(item.user)}
													</p>
													<div className="flex items-center gap-1 ml-2">
														{item.emojis.map((emoji, i) => (
															<span key={i} className="text-base leading-none" title={emoji}>
																{emoji}
															</span>
														))}
													</div>
												</div>
												<div className="flex items-center justify-between mt-0.5">
													<span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
														{formatTime(item.reactedAt)}
													</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</ScrollArea>
					</div>
				</BottomSheet>
			</>
		);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<div
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					onTouchStart={handleTouchStart}
					onTouchEnd={handleTouchEnd}
					onTouchMove={handleTouchMove}
					className="cursor-pointer"
				>
					{children}
				</div>
			</PopoverTrigger>
			<PopoverContent
				className="w-80 p-0 bg-white dark:bg-black border-gray-300 dark:border-gray-700"
				side="top"
				align="center"
				sideOffset={8}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				<div className="p-3 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-black rounded-t-md">
					<div className="flex items-center justify-between">
						<span className="text-sm font-semibold text-black dark:text-white">
							Reactions
						</span>
						<span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
							{totalReactions} {totalReactions === 1 ? 'total' : 'total'}
						</span>
					</div>
				</div>

				<ScrollArea className="max-h-64">
					<div className="p-2">
						{userReactions.map((item, index) => {
							const isCurrentUser = (item.user?._id || item.user)?.toString() === currentUserId?.toString();

							return (
								<div
									key={`${item.user?._id || index}-${index}`}
									className={`flex items-center gap-3 px-2 py-2 rounded-md transition-colors ${isCurrentUser
										? 'bg-gray-100 dark:bg-gray-800'
										: 'hover:bg-gray-50 dark:hover:bg-gray-900'
										}`}
								>
									<Avatar className="h-8 w-8 flex-shrink-0">
										<AvatarImage src={item.user?.image || item.user?.avatar} />
										<AvatarFallback className="bg-black dark:bg-white text-white dark:text-black text-xs">
											{getInitials(item.user)}
										</AvatarFallback>
									</Avatar>

									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between">
											<p className={`text-sm font-medium truncate ${isCurrentUser
												? 'text-black dark:text-white font-semibold'
												: 'text-gray-900 dark:text-gray-100'
												}`}>
												{isCurrentUser ? 'You' : getUserDisplayName(item.user)}
											</p>
											<div className="flex items-center gap-1 ml-2">
												{item.emojis.map((emoji, i) => (
													<button
														key={i}
														className="text-base leading-none"
														title={emoji}
														onClick={(e) => {
															e.stopPropagation();
															handleEmojiToggle(emoji);
														}}
													>
														{emoji}
													</button>
												))}
											</div>
										</div>
										<div className="flex items-center justify-between mt-0.5">
											{item.user?.username && !isCurrentUser && (
												<p className="text-xs text-gray-500 dark:text-gray-400 truncate">
													@{item.user.username}
												</p>
											)}
											<span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
												{formatTime(item.reactedAt)}
											</span>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}

export default memo(ReactionTooltip);