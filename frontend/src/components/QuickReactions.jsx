import { useState, useRef, useEffect, memo } from 'react';
import { Plus, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const QuickReactions = memo(({
	message,
	currentUser,
	showQuickReactions,
	isCurrentUserMessage,
	onReaction,
	onClose,
	pickerOnly = false
}) => {
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
	const emojiPickerRef = useRef(null);
	const triggerRef = useRef(null);

	const handleQuickReaction = (emoji) => {
		const hasReacted = message.reactions?.some(
			r => r.emoji === emoji && (r.user?._id === currentUser._id || r.user === currentUser._id)
		);
		onReaction(message._id || message.id, emoji, hasReacted);
	};

	// Calculate emoji picker position to keep it in viewport
	const calculatePickerPosition = () => {
		if (!triggerRef.current) return;

		const rect = triggerRef.current.getBoundingClientRect();
		const pickerWidth = 320;
		const pickerHeight = 400;
		const padding = 10;

		let top = rect.bottom + padding;
		let left = rect.left;

		// Check if picker goes below viewport
		if (top + pickerHeight > window.innerHeight) {
			// Position above the trigger
			top = rect.top - pickerHeight - padding;
		}

		// Check if picker goes below viewport even when positioned above
		if (top < 0) {
			// Center vertically in viewport
			top = (window.innerHeight - pickerHeight) / 2;
		}

		// Check if picker goes beyond right edge
		if (left + pickerWidth > window.innerWidth) {
			left = window.innerWidth - pickerWidth - padding;
		}

		// Check if picker goes beyond left edge
		if (left < padding) {
			left = padding;
		}

		setPickerPosition({ top, left });
	};

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
				setShowEmojiPicker(false);
				onClose?.();
			}
		};

		if (showEmojiPicker) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showEmojiPicker, onClose]);

	// Recalculate position when emoji picker opens or window resizes
	useEffect(() => {
		if (showEmojiPicker) {
			calculatePickerPosition();
			window.addEventListener('resize', calculatePickerPosition);
			window.addEventListener('scroll', calculatePickerPosition, true);

			return () => {
				window.removeEventListener('resize', calculatePickerPosition);
				window.removeEventListener('scroll', calculatePickerPosition, true);
			};
		}
	}, [showEmojiPicker]);

	const renderReactions = () => {
		if (!message.reactions || message.reactions.length === 0) return null;

		const reactionGroups = message.reactions.reduce((acc, reaction) => {
			if (!acc[reaction.emoji]) {
				acc[reaction.emoji] = [];
			}
			const userId = reaction.user?._id || reaction.user;
			acc[reaction.emoji].push(userId);
			return acc;
		}, {});

		return (
			<div className="flex flex-wrap gap-1 mt-1">
				{Object.entries(reactionGroups).map(([emoji, users]) => {
					const hasCurrentUserReacted = users.some(
						(userId) => userId?.toString() === currentUser._id?.toString()
					);

					return (
						<button
							key={emoji}
							onClick={() => onReaction(message._id || message.id, emoji, hasCurrentUserReacted)}
							className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${hasCurrentUserReacted
								? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700'
								: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
								} hover:scale-110`}
						>
							<span>{emoji}</span>
							{users.length > 1 && <span className="text-gray-600 dark:text-gray-400">{users.length}</span>}
						</button>
					);
				})}
			</div>
		);
	};

	// If pickerOnly mode, just show the quick reactions and emoji picker
	if (pickerOnly) {
		return (
			<>
				<div
					ref={triggerRef}
					className={`absolute ${isCurrentUserMessage ? 'right-0' : 'left-0'} bottom-full mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex gap-1 z-10`}
				>
					{QUICK_REACTIONS.map((emoji) => (
						<button
							key={emoji}
							onClick={() => {
								handleQuickReaction(emoji);
							}}
							className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
						>
							<span className="text-lg">{emoji}</span>
						</button>
					))}
					<button
						onClick={() => setShowEmojiPicker(true)}
						className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						title="More reactions"
					>
						<Plus className="h-5 w-5 text-gray-500" />
					</button>
				</div>

				{showEmojiPicker && (
					<div
						ref={emojiPickerRef}
						className="fixed z-50"
						style={{
							top: `${pickerPosition.top}px`,
							left: `${pickerPosition.left}px`,
						}}
					>
						<EmojiPicker
							onEmojiClick={(emojiData) => {
								handleQuickReaction(emojiData.emoji);
								setShowEmojiPicker(false);
							}}
							theme="auto"
							previewConfig={{ showPreview: false }}
							searchDisabled={false}
							skinTonesDisabled={true}
							width={320}
							height={400}
						/>
					</div>
				)}
			</>
		);
	}

	// Original mode - show reactions below message
	return (
		<>
			{renderReactions()}

			{showQuickReactions && (
				<div className={`absolute ${isCurrentUserMessage ? 'right-0' : 'left-0'} -top-10 bg-white dark:bg-gray-800 shadow-lg rounded-full px-2 py-1 flex gap-1 border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
					{QUICK_REACTIONS.map((emoji) => (
						<button
							key={emoji}
							onClick={() => handleQuickReaction(emoji)}
							className="hover:scale-125 transition-transform text-xl p-1"
							title={`React with ${emoji}`}
						>
							{emoji}
						</button>
					))}
					<button
						ref={triggerRef}
						onClick={() => setShowEmojiPicker(true)}
						className="hover:scale-125 transition-transform p-1"
						title="More reactions"
					>
						<Smile className="h-5 w-5 text-gray-500" />
					</button>
				</div>
			)}

			{showEmojiPicker && (
				<div
					ref={emojiPickerRef}
					className="fixed z-50"
					style={{
						top: `${pickerPosition.top}px`,
						left: `${pickerPosition.left}px`,
					}}
				>
					<EmojiPicker
						onEmojiClick={(emojiData) => {
							handleQuickReaction(emojiData.emoji);
							setShowEmojiPicker(false);
						}}
						theme="auto"
						previewConfig={{ showPreview: false }}
						searchDisabled={false}
						skinTonesDisabled={true}
						width={320}
						height={400}
					/>
				</div>
			)}
		</>
	);
});

QuickReactions.displayName = 'QuickReactions';

export default QuickReactions;