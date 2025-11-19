import { memo, useState, useEffect } from 'react';
import { Check, CheckCheck, Clock, XCircle, Reply, Copy, Forward, Star, Pin, Trash2, Edit3, Info, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from '@/utils/helpers';
import MessageInfoPopover from '@/components/MessageInfoPopover';

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
	const [showMessageInfo, setShowMessageInfo] = useState(false);
	
	// Auto-open popover when messageInfo is set from onInfo click
	useEffect(() => {
		if (messageInfo) {
			setShowMessageInfo(true);
		}
	}, [messageInfo]);
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

			{/* Message Info Popover - WhatsApp Style */}
			{messageInfo && (
				<MessageInfoPopover
					message={messageInfo}
					isOpen={showMessageInfo}
					onOpenChange={(open) => {
						setShowMessageInfo(open);
						if (!open) {
							onCloseInfo();
						}
					}}
				/>
			)}

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
							onClick={() => {
								onCloseLongPress();
								setShowMessageInfo(true);
							}}
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