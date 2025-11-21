import { useEffect, useState, useCallback } from 'react';
import { CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials } from '@/utils/helpers';
import api from '@/utils/axiosInstance';
import { MESSAGE_ROUTES } from '@/utils/ApiRoutes';
import { toast } from 'sonner';

const MessageInfoPopover = ({ message, isOpen, onOpenChange, anchorRef }) => {
	const [info, setInfo] = useState(null);
	const [loading, setLoading] = useState(false);

	const messageId = message?._id || message?.id;

	const fetchMessageInfo = useCallback(async () => {
		if (!messageId) return;

		try {
			setLoading(true);
			const response = await api.get(`${MESSAGE_ROUTES}/${messageId}/info`);
			setInfo(response.data);
		} catch (error) {
			console.error('Error fetching message info:', error);
			if (error.name !== 'CanceledError') {
				toast.error('Failed to load message info');
			}
		} finally {
			setLoading(false);
		}
	}, [messageId]);

	useEffect(() => {
		if (isOpen && messageId) {
			fetchMessageInfo();
		} else {
			setInfo(null);
		}
	}, [isOpen, messageId, fetchMessageInfo]);

	// Format time like WhatsApp
	const formatTime = (dateString) => {
		if (!dateString) return '';
		const date = new Date(dateString);

		if (isToday(date)) {
			return `Today, ${format(date, 'h:mm a')}`;
		} else if (isYesterday(date)) {
			return `Yesterday, ${format(date, 'h:mm a')}`;
		} else {
			return format(date, 'MMM d, h:mm a');
		}
	};

	// Get user display name (firstName lastName)
	const getUserDisplayName = (user) => {
		if (!user) return 'Unknown';
		const firstName = user.firstName || '';
		const lastName = user.lastName || '';
		const fullName = `${firstName} ${lastName}`.trim();
		return fullName || user.name || user.username || 'Unknown';
	};

	// Get user secondary info (phone or username)
	const getUserSecondaryInfo = (user) => {
		if (!user) return '';
		return user.phone || user.username || user.email || '';
	};

	if (!isOpen) return null;

	const isGroupMessage = info?.isGroupMessage;
	const hasReadReceipts = info?.readReceipts && info.readReceipts.length > 0;
	const hasDeliveredReceipts = info?.deliveredButNotReadUsers && info.deliveredButNotReadUsers.length > 0;

	return (
		<Popover open={isOpen} onOpenChange={onOpenChange}>
			{anchorRef && <PopoverAnchor virtualRef={{ current: anchorRef }} />}
			<PopoverContent
				className="w-auto p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-lg overflow-hidden"
				side="left"
				align="start"
				sideOffset={8}
				alignOffset={-10}
				collisionPadding={16}
				avoidCollisions={true}
			>
				{loading ? (
					<div className="flex justify-center items-center py-12 px-8">
						<div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-500"></div>
					</div>
				) : info ? (
					<>
						{/* For Direct Messages - Simple Layout */}
						{!isGroupMessage && (
							<div className="p-4 min-w-[200px]">
								<div className="space-y-3">
									{info.readAt && (
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<CheckCheck className="h-4 w-4 text-blue-500" />
												<span className="text-sm text-gray-700 dark:text-gray-300">Read</span>
											</div>
											<span className="text-sm text-gray-500 dark:text-gray-400">
												{formatTime(info.readAt)}
											</span>
										</div>
									)}
									{info.deliveredAt && (
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<CheckCheck className="h-4 w-4 text-gray-400" />
												<span className="text-sm text-gray-700 dark:text-gray-300">Delivered &nbsp;</span>
											</div>
											<span className="text-sm text-gray-500 dark:text-gray-400">
												{formatTime(info.deliveredAt)}
											</span>
										</div>
									)}
								</div>
							</div>
						)}

						{/* For Group Messages - Detailed Layout */}
						{isGroupMessage && (
							<div className="w-[400px]">
								<ScrollArea className="max-h-[500px]">
									<div className="py-2">
										{/* Read By Section */}
										<div className="mb-1">
											<div className="px-4 py-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50">
												<CheckCheck className="h-5 w-5 text-blue-500" />
												<span className="text-sm font-medium text-blue-600 dark:text-blue-400">
													Read by
												</span>
											</div>

											{hasReadReceipts ? (
												<div>
													{info.readReceipts.map((receipt, idx) => (
														<div
															key={idx}
															className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 last:border-0"
														>
															<Avatar className="h-10 w-10 flex-shrink-0">
																<AvatarImage src={receipt.user.image || receipt.user.avatar} />
																<AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-sm">
																	{getInitials(getUserDisplayName(receipt.user))}
																</AvatarFallback>
															</Avatar>
															<div className="flex-1 min-w-0">
																<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
																	{getUserDisplayName(receipt.user)}
																</p>
																<p className="text-xs text-gray-500 dark:text-gray-400 truncate">
																	{getUserSecondaryInfo(receipt.user)}
																</p>
															</div>
															<div className="text-right flex-shrink-0">
																<p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
																	{formatTime(receipt.readAt)}
																</p>
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="px-4 py-3 text-sm text-gray-400 italic">
													No one has read yet
												</div>
											)}
										</div>

										{/* Delivered To Section */}
										<div>
											<div className="px-4 py-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50">
												<CheckCheck className="h-5 w-5 text-gray-400" />
												<span className="text-sm font-medium text-gray-600 dark:text-gray-400">
													Delivered to
												</span>
											</div>

											{hasDeliveredReceipts ? (
												<div>
													{info.deliveredButNotReadUsers.map((item, idx) => (
														<div
															key={idx}
															className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 last:border-0"
														>
															<Avatar className="h-10 w-10 flex-shrink-0">
																<AvatarImage src={item.user.image || item.user.avatar} />
																<AvatarFallback className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm">
																	{getInitials(getUserDisplayName(item.user))}
																</AvatarFallback>
															</Avatar>
															<div className="flex-1 min-w-0">
																<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
																	{getUserDisplayName(item.user)}
																</p>
																<p className="text-xs text-gray-500 dark:text-gray-400 truncate">
																	{getUserSecondaryInfo(item.user)}
																</p>
															</div>
															<div className="text-right flex-shrink-0">
																<p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
																	{formatTime(item.deliveredAt)}
																</p>
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="px-4 py-3 text-sm text-gray-400 italic">
													{hasReadReceipts ? 'Everyone has read' : 'Not delivered yet'}
												</div>
											)}
										</div>
									</div>
								</ScrollArea>
							</div>
						)}
					</>
				) : (
					<div className="text-center text-gray-500 py-8 px-4">
						<p className="text-sm">Unable to load message info</p>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
};

export default MessageInfoPopover;