import { useState, useEffect, useCallback } from 'react';
import { Check, CheckCheck, Clock, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { getInitials } from '@/utils/helpers';

const MessageInfoPopover = ({ message, isOpen, onOpenChange }) => {
	const [messageInfo, setMessageInfo] = useState(null);
	const [loading, setLoading] = useState(false);

	const fetchMessageInfo = useCallback(async () => {
		if (!message?._id) return;

		setLoading(true);
		try {
			const token = localStorage.getItem('token');
			const response = await fetch(`/api/messages/${message._id}/info`, {
				headers: {
					'Authorization': `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				console.log('✅ Message info loaded:', data);
				setMessageInfo(data);
			} else {
				console.error('❌ Failed to fetch message info:', response.status);
			}
		} catch (err) {
			console.error('❌ Error fetching message info:', err);
		} finally {
			setLoading(false);
		}
	}, [message?._id]);

	useEffect(() => {
		if (isOpen && message?._id) {
			console.log('🔄 Fetching message info for:', message._id);
			fetchMessageInfo();
		}
	}, [isOpen, message?._id, fetchMessageInfo]);

	const formatTime = (timestamp) => {
		if (!timestamp) return '';
		try {
			return new Date(timestamp).toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
			});
		} catch {
			return '';
		}
	};

	const getUserDisplayName = (user) => {
		if (!user) return 'Unknown';
		if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
		if (user.firstName) return user.firstName;
		if (user.lastName) return user.lastName;
		if (user.username) return user.username;
		return 'Unknown';
	};

	if (!isOpen || !message) return null;

	console.log('📊 Rendering MessageInfoPopover:', { isOpen, loading, messageInfo });

	// For direct messages (single recipient)
	const renderDirectMessage = () => (
		<>
			{/* Backdrop */}
			<div 
				className="fixed inset-0 bg-black/30 z-40" 
				onClick={() => onOpenChange(false)}
			/>
			
			{/* Popover */}
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-lg z-50 overflow-hidden">
				{/* Header */}
				<div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
					<h3 className="text-sm font-semibold">Message Info</h3>
					<button onClick={() => onOpenChange(false)} className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded p-1">
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Content */}
				{loading ? (
					<div className="px-4 py-12 text-center">
						<div className="inline-block animate-spin">
							<Clock className="h-6 w-6 text-gray-400" />
						</div>
						<p className="mt-2 text-xs text-gray-500">Loading...</p>
					</div>
				) : messageInfo ? (
					<div className="p-4 space-y-4">
						{/* Sent Time */}
						<div className="flex items-start gap-3">
							<Check className="h-4 w-4 text-gray-400 mt-0.5" />
							<div className="flex-1">
								<p className="text-xs font-medium text-gray-700 dark:text-gray-300">Sent</p>
								<p className="text-xs text-gray-500">
									{new Date(messageInfo.createdAt).toLocaleString()}
								</p>
							</div>
						</div>

						<Separator />

						{/* Delivered/Read Status */}
						{messageInfo.deliveryStatus === 'read' ? (
							<div className="flex items-start gap-3">
								<CheckCheck className="h-4 w-4 text-blue-500 mt-0.5" />
								<div className="flex-1">
									<p className="text-xs font-medium text-gray-700 dark:text-gray-300">Read</p>
									<p className="text-xs text-gray-500">
										{messageInfo.readReceipts?.[0]?.readAt
											? new Date(messageInfo.readReceipts[0].readAt).toLocaleString()
											: 'Just now'}
									</p>
								</div>
							</div>
						) : messageInfo.deliveryStatus === 'delivered' ? (
							<div className="flex items-start gap-3">
								<CheckCheck className="h-4 w-4 text-gray-400 mt-0.5" />
								<div className="flex-1">
									<p className="text-xs font-medium text-gray-700 dark:text-gray-300">Delivered</p>
									<p className="text-xs text-gray-500">
										{messageInfo.deliveryReceipts?.[0]?.deliveredAt
											? new Date(messageInfo.deliveryReceipts[0].deliveredAt).toLocaleString()
											: 'Just now'}
									</p>
								</div>
							</div>
						) : (
							<div className="flex items-start gap-3">
								<Clock className="h-4 w-4 text-gray-400 mt-0.5" />
								<div className="flex-1">
									<p className="text-xs font-medium text-gray-700 dark:text-gray-300">Pending</p>
									<p className="text-xs text-gray-500">Not delivered yet</p>
								</div>
							</div>
						)}

						{messageInfo.isEdited && messageInfo.editedAt && (
							<>
								<Separator />
								<p className="text-xs text-gray-500">Edited {formatTime(messageInfo.editedAt)}</p>
							</>
						)}
					</div>
				) : (
					<div className="px-4 py-8 text-center text-xs text-gray-500">
						No information available
					</div>
				)}
			</div>
		</>
	);

	// For group messages
	const renderGroupMessage = () => (
		<>
			{/* Backdrop */}
			<div 
				className="fixed inset-0 bg-black/30 z-40" 
				onClick={() => onOpenChange(false)}
			/>
			
			{/* Popover */}
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 max-w-[95vw] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-lg max-h-[80vh] overflow-hidden flex flex-col z-50">
				{/* Header */}
				<div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
					<h3 className="text-sm font-semibold">Message Info</h3>
					<button onClick={() => onOpenChange(false)} className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded p-1">
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Content */}
				{loading ? (
					<div className="px-4 py-12 text-center flex-1 flex items-center justify-center flex-col">
						<div className="inline-block animate-spin">
							<Clock className="h-6 w-6 text-gray-400" />
						</div>
						<p className="mt-2 text-xs text-gray-500">Loading...</p>
					</div>
				) : messageInfo ? (
					<div className="flex-1 overflow-y-auto">
						<div className="p-4 space-y-4">
							{/* Message Sent Time */}
							<div className="text-xs text-gray-500 pb-3 border-b border-gray-100 dark:border-gray-700">
								Sent {formatTime(messageInfo.createdAt)}
							</div>

							{/* Read By Section */}
							{messageInfo.readCount > 0 && messageInfo.readReceipts && messageInfo.readReceipts.length > 0 && (
								<div>
									<p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
										READ ({messageInfo.readCount})
									</p>
									<div className="space-y-2">
										{messageInfo.readReceipts.map((receipt, idx) => (
											<div key={idx} className="flex items-center justify-between">
												<div className="flex items-center gap-2 flex-1 min-w-0">
													<Avatar className="h-8 w-8 flex-shrink-0">
														<AvatarImage src={receipt.user?.image} />
														<AvatarFallback className="text-xs bg-blue-500 text-white">
															{getInitials(getUserDisplayName(receipt.user))}
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0 flex-1">
														<p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
															{getUserDisplayName(receipt.user)}
														</p>
														{receipt.user?.username && (
															<p className="text-xs text-gray-500 truncate">@{receipt.user.username}</p>
														)}
													</div>
												</div>
												<span className="text-xs text-gray-500 flex-shrink-0 ml-2">
													{formatTime(receipt.readAt)}
												</span>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Delivered But Not Read Section */}
							{messageInfo.deliveredButNotReadCount > 0 && messageInfo.deliveredButNotReadUsers && messageInfo.deliveredButNotReadUsers.length > 0 && (
								<div>
									<p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
										DELIVERED ({messageInfo.deliveredButNotReadCount})
									</p>
									<div className="space-y-2">
										{messageInfo.deliveredButNotReadUsers.map((user, idx) => {
											const receipt = messageInfo.deliveryReceipts?.find(
												r => r.user?._id === user?._id
											);
											return (
												<div key={idx} className="flex items-center justify-between">
													<div className="flex items-center gap-2 flex-1 min-w-0">
														<Avatar className="h-8 w-8 flex-shrink-0">
															<AvatarImage src={user?.image} />
															<AvatarFallback className="text-xs bg-gray-400 text-white">
																{getInitials(getUserDisplayName(user))}
															</AvatarFallback>
														</Avatar>
														<div className="min-w-0 flex-1">
															<p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
																{getUserDisplayName(user)}
															</p>
															{user?.username && (
																<p className="text-xs text-gray-500 truncate">@{user.username}</p>
															)}
														</div>
													</div>
													<span className="text-xs text-gray-500 flex-shrink-0 ml-2">
														{formatTime(receipt?.deliveredAt)}
													</span>
												</div>
											);
										})}
									</div>
								</div>
							)}

							{/* Not Delivered Section */}
							{messageInfo.notDeliveredCount > 0 && messageInfo.notDeliveredUsers && messageInfo.notDeliveredUsers.length > 0 && (
								<div>
									<p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
										PENDING ({messageInfo.notDeliveredCount})
									</p>
									<div className="space-y-2">
										{messageInfo.notDeliveredUsers.map((user, idx) => (
											<div key={idx} className="flex items-center gap-2">
												<Avatar className="h-8 w-8 flex-shrink-0">
													<AvatarImage src={user?.image} />
													<AvatarFallback className="text-xs bg-gray-300 text-gray-600">
														{getInitials(getUserDisplayName(user))}
													</AvatarFallback>
												</Avatar>
												<div className="min-w-0 flex-1">
													<p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
														{getUserDisplayName(user)}
													</p>
													{user?.username && (
														<p className="text-xs text-gray-500 truncate">@{user.username}</p>
													)}
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="px-4 py-8 text-center text-xs text-gray-500 flex-1">
						No information available
					</div>
				)}
			</div>
		</>
	);

	return messageInfo?.isGroupMessage ? renderGroupMessage() : renderDirectMessage();
};

export default MessageInfoPopover;
