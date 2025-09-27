import React from 'react';
import {
	Paperclip,
	Send,
	Smile,
} from 'lucide-react';

function ChatMessageInput({
	messageInput,
	setMessageInput,
	handleSendMessage,
	inputRef,
	showEmojiPicker,
	setShowEmojiPicker
}) {
	return (
		<div className="relative">
			{/* Emoji Picker */}
			{showEmojiPicker && (
				<div className="absolute bottom-full left-0 right-0 mb-2 z-20">
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-4 max-h-64 overflow-y-auto">
						<div className="grid grid-cols-8 gap-2">
							{['😀', '😂', '🥰', '😍', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '💯', '😎'].map((emoji, index) => (
								<button
									key={index}
									type="button"
									onClick={() => {
										setMessageInput(prev => prev + emoji);
										setShowEmojiPicker(false);
									}}
									className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xl"
								>
									{emoji}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Message Input Form */}
			<div className="p-4 flex items-end space-x-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
				{/* Emoji Button */}
				<button
					type="button"
					onClick={() => setShowEmojiPicker(!showEmojiPicker)}
					className={`p-2 rounded-full transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${showEmojiPicker ? 'bg-gray-100 dark:bg-gray-700' : ''
						}`}
					aria-label="Toggle emoji picker"
				>
					<Smile className="h-6 w-6 text-gray-500 dark:text-gray-400" />
				</button>

				{/* File Upload Button */}
				<div className="relative">
					<button
						type="button"
						onClick={() => {
							console.log('File upload clicked');
						}}
						className="p-2 rounded-full transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
						aria-label="Attach file"
					>
						<Paperclip className="h-6 w-6 text-gray-500 dark:text-gray-400" />
					</button>
				</div>

				{/* Message Input */}
				<div className="flex-1 relative">
					<textarea
						ref={inputRef}
						value={messageInput}
						onChange={e => setMessageInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								handleSendMessage(e);
							}
						}}
						placeholder="Type a message"
						rows={1}
						className="w-full py-2 px-4 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200 resize-none bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-gray-600 max-h-32"
						style={{ minHeight: '40px' }}
						maxLength={1000}
					/>
					{messageInput.trim() && (
						<div className="absolute bottom-1 right-1 text-xs text-gray-400">
							{messageInput.length}/1000
						</div>
					)}
				</div>

				{/* Send Button */}
				{messageInput.trim() ? (
					<button
						type="button"
						onClick={handleSendMessage}
						className="p-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95"
						aria-label="Send message"
					>
						<Send className="h-6 w-6" />
					</button>
				) : (
					<button
						type="button"
						onClick={() => {
							console.log('Voice recording clicked');
						}}
						className="p-2 rounded-full transition-colors duration-200 transform active:scale-95 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
						aria-label="Hold to record voice message"
					>
						<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
						</svg>
					</button>
				)}
			</div>
		</div>
	);
}

export default ChatMessageInput;