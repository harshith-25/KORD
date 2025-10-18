import { memo } from 'react';
import { Check, CheckCheck, Clock, XCircle, Reply, Copy, Forward, Star, Pin, Trash2, Edit3, Info, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from '@/utils/helpers';

const MessageActions = memo(({
	deletingMessage,
	deleteForEveryone,
	onConfirmDelete,
	onCancelDelete,
	forwardingMessage,
	selectedContacts,
	dmContacts,
	onContactToggle,
	onForwardSend,
	onCancelForward,
	messageInfo,
	onCloseInfo,
	longPressedMessage,
	onCloseLongPress,
	onLongPressAction,
	currentUser
}) => {
	const isCurrentUserMessage = (message) => {
		return message?.sender?._id === currentUser?._id ||
			message?.sender === currentUser?._id ||
			message?.senderId === currentUser?._id;
	};

	return (
		<>
			{/* Delete Message Dialog */}
			<Dialog open={!!deletingMessage} onOpenChange={(open) => !open && onCancelDelete()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Message</DialogTitle>
						<DialogDescription>
							{deleteForEveryone
								? "This message will be deleted for everyone in the conversation. This action cannot be undone."
								: "This message will only be deleted for you. Other participants will still see it."
							}
							{deletingMessage?.replyCount > 0 && deleteForEveryone && (
								<span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
									⚠️ This message has {deletingMessage.replyCount} {deletingMessage.replyCount === 1 ? 'reply' : 'replies'}.
									They will be marked as unavailable.
								</span>
							)}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={onCancelDelete}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={onConfirmDelete}>
							Delete {deleteForEveryone && "for Everyone"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Forward Message Sheet (Mobile-like) */}
			<Sheet open={!!forwardingMessage} onOpenChange={(open) => !open && onCancelForward()}>
				<SheetContent side="bottom" className="h-[80vh]">
					<SheetHeader>
						<SheetTitle>Forward Message To</SheetTitle>
						<SheetDescription>
							Select one or more contacts to forward this message to
						</SheetDescription>
					</SheetHeader>
					<ScrollArea className="h-[calc(80vh-180px)] mt-4">
						{dmContacts && dmContacts.length > 0 ? (
							<div className="space-y-2">
								{dmContacts.map((contact) => (
									<div
										key={contact._id}
										onClick={() => onContactToggle(contact)}
										className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${selectedContacts.find(c => c._id === contact._id)
											? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
											: 'border-2 border-transparent'
											}`}
									>
										<Avatar>
											<AvatarImage src={contact.image} />
											<AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
												{getInitials(contact.name || contact.username)}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<p className="font-medium text-sm">{contact.name || contact.username}</p>
											<p className="text-xs text-gray-500">{contact.email}</p>
										</div>
										{selectedContacts.find(c => c._id === contact._id) && (
											<Check className="h-5 w-5 text-green-500" />
										)}
									</div>
								))}
							</div>
						) : (
							<div className="flex items-center justify-center h-32 text-gray-500">
								<p>No contacts available</p>
							</div>
						)}
					</ScrollArea>
					<div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t">
						<div className="flex gap-3">
							<Button variant="outline" onClick={onCancelForward} className="flex-1">
								Cancel
							</Button>
							<Button
								onClick={onForwardSend}
								disabled={selectedContacts.length === 0}
								className="flex-1"
							>
								Forward {selectedContacts.length > 0 && `(${selectedContacts.length})`}
							</Button>
						</div>
					</div>
				</SheetContent>
			</Sheet>

			{/* Message Info Dialog */}
			<Dialog open={!!messageInfo} onOpenChange={(open) => !open && onCloseInfo()}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Message Info</DialogTitle>
						<DialogDescription>
							Detailed information about this message
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</p>
							<div className="flex items-center gap-2">
								{messageInfo?.status === 'read' && <CheckCheck className="h-4 w-4 text-blue-500" />}
								{messageInfo?.status === 'delivered' && <CheckCheck className="h-4 w-4 text-gray-400" />}
								{messageInfo?.status === 'sent' && <Check className="h-4 w-4 text-gray-400" />}
								{messageInfo?.status === 'sending' && <Clock className="h-4 w-4 text-gray-400" />}
								{messageInfo?.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
								<span className="text-sm capitalize">
									{messageInfo?.status || messageInfo?.deliveryStatus || 'Unknown'}
								</span>
							</div>
						</div>

						<div>
							<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Sent</p>
							<p className="text-sm">
								{messageInfo?.createdAt && new Date(messageInfo.createdAt).toLocaleString('en-US', {
									weekday: 'short',
									year: 'numeric',
									month: 'short',
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit',
									second: '2-digit'
								})}
							</p>
						</div>

						{messageInfo?.isEdited && messageInfo?.editedAt && (
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Edited</p>
								<p className="text-sm">
									{new Date(messageInfo.editedAt).toLocaleString('en-US', {
										weekday: 'short',
										year: 'numeric',
										month: 'short',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit',
										second: '2-digit'
									})}
								</p>
							</div>
						)}

						{/* Show reply info if message is a reply */}
						{messageInfo?.metadata?.replyTo && (
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Reply To</p>
								<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
									<p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
										{messageInfo.metadata.replyTo.senderName || 'User'}
									</p>
									<p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-2">
										{messageInfo.metadata.replyTo.content || 'Message'}
									</p>
								</div>
							</div>
						)}

						{/* Show reply count if message has replies */}
						{messageInfo?.replyCount > 0 && (
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
									Replies
								</p>
								<div className="flex items-center gap-2 text-sm">
									<Reply className="h-4 w-4 text-green-500" />
									<span>{messageInfo.replyCount} {messageInfo.replyCount === 1 ? 'reply' : 'replies'} to this message</span>
								</div>
							</div>
						)}

						{messageInfo?.readBy && messageInfo.readBy.length > 0 && (
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
									Read By ({messageInfo.readBy.length})
								</p>
								<ScrollArea className="max-h-[200px] border rounded-md">
									<div className="p-2">
										{messageInfo.readBy.map((receipt, idx) => {
											const user = typeof receipt.user === 'object' ? receipt.user : null;
											const userName = user?.name || user?.username || 'User';
											const userNameParts = userName.split(' ');
											const displayName = userNameParts[0]; // Show first name
											const readTime = receipt.readAt;

											return (
												<div key={idx} className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
													<div className="flex items-center gap-2">
														<Avatar className="h-8 w-8">
															<AvatarImage src={user?.image} />
															<AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-500 text-white">
																{getInitials(userName)}
															</AvatarFallback>
														</Avatar>
														<span className="text-sm font-medium">{displayName}</span>
													</div>
													<span className="text-xs text-gray-500">
														{readTime && new Date(readTime).toLocaleString('en-US', {
															month: 'short',
															day: 'numeric',
															hour: '2-digit',
															minute: '2-digit'
														})}
													</span>
												</div>
											);
										})}
									</div>
								</ScrollArea>
							</div>
						)}

						{messageInfo?.reactions && messageInfo.reactions.length > 0 && (
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
									Reactions ({messageInfo.reactions.length})
								</p>
								<div className="flex flex-wrap gap-2">
									{messageInfo.reactions.map((reaction, idx) => {
										const user = typeof reaction.user === 'object' ? reaction.user : null;
										const userName = user?.name || user?.username || 'User';
										const userNameParts = userName.split(' ');
										const displayName = userNameParts[0];

										return (
											<div key={idx} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
												<span>{reaction.emoji}</span>
												<span className="text-xs text-gray-600 dark:text-gray-400">
													{displayName}
												</span>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{messageInfo?.isForwarded && (
							<div className="flex items-center gap-2 text-sm text-gray-500">
								<Forward className="h-4 w-4" />
								<span>Forwarded message</span>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			{/* Long Press Action Sheet (Mobile) */}
			<Sheet open={!!longPressedMessage} onOpenChange={(open) => !open && onCloseLongPress()}>
				<SheetContent side="bottom" className="h-auto">
					<SheetHeader>
						<SheetTitle>Message Actions</SheetTitle>
					</SheetHeader>
					<div className="grid grid-cols-1 gap-2 mt-4 pb-4">
						{!longPressedMessage?.isDeleted && (
							<>
								<Button
									variant="ghost"
									className="justify-start h-12"
									onClick={() => onLongPressAction('reply', longPressedMessage)}
								>
									<Reply className="mr-3 h-5 w-5" />
									Reply
								</Button>
								<Button
									variant="ghost"
									className="justify-start h-12"
									onClick={() => onLongPressAction('copy', longPressedMessage)}
								>
									<Copy className="mr-3 h-5 w-5" />
									Copy
								</Button>
								<Button
									variant="ghost"
									className="justify-start h-12"
									onClick={() => onLongPressAction('forward', longPressedMessage)}
								>
									<Forward className="mr-3 h-5 w-5" />
									Forward
								</Button>
								<Button
									variant="ghost"
									className="justify-start h-12"
								>
									<Star className="mr-3 h-5 w-5" />
									Star
								</Button>
								<Button
									variant="ghost"
									className="justify-start h-12"
								>
									<Pin className="mr-3 h-5 w-5" />
									Pin
								</Button>
							</>
						)}

						{isCurrentUserMessage(longPressedMessage) && !longPressedMessage?.isDeleted && longPressedMessage?.status !== 'failed' && (
							<Button
								variant="ghost"
								className="justify-start h-12"
								onClick={() => onLongPressAction('edit', longPressedMessage)}
							>
								<Edit3 className="mr-3 h-5 w-5" />
								Edit
							</Button>
						)}

						<Button
							variant="ghost"
							className="justify-start h-12 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
							onClick={() => onLongPressAction('delete', longPressedMessage)}
						>
							<Trash2 className="mr-3 h-5 w-5" />
							Delete for me
						</Button>

						{isCurrentUserMessage(longPressedMessage) && !longPressedMessage?.isDeleted && (
							<Button
								variant="ghost"
								className="justify-start h-12 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
								onClick={() => onLongPressAction('deleteForEveryone', longPressedMessage)}
							>
								<Trash2 className="mr-3 h-5 w-5" />
								Delete for everyone
							</Button>
						)}

						<Button
							variant="ghost"
							className="justify-start h-12"
							onClick={() => onLongPressAction('info', longPressedMessage)}
						>
							<Info className="mr-3 h-5 w-5" />
							Info
						</Button>
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
});

MessageActions.displayName = 'MessageActions';

export default MessageActions;