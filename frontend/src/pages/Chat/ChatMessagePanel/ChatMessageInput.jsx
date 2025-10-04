import { useEffect, useRef, useState, useCallback } from 'react';
import { Paperclip, Send, Smile, FileText, Image, Camera, BarChart3, X, File } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { useSocketStore } from '@/store/socketStore';

function ChatMessageInput({
	messageInput,
	setMessageInput,
	handleSendMessage,
	inputRef,
	conversationId
}) {
	// Refs for different functionalities
	const emojiRef = useRef();
	const attachmentRef = useRef();
	const documentInputRef = useRef();
	const imageInputRef = useRef();
	const cameraInputRef = useRef();
	const dragRef = useRef(null);

	// State management
	const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [showPollModal, setShowPollModal] = useState(false);
	const [pollQuestion, setPollQuestion] = useState('');
	const [pollOptions, setPollOptions] = useState(['', '']);

	// Drag and drop states
	const [isDragOver, setIsDragOver] = useState(false);
	const [dragCounter, setDragCounter] = useState(0);
	const [selectedFiles, setSelectedFiles] = useState([]);

	const emitTyping = useSocketStore((state) => state.emitTyping);
	const emitStopTyping = useSocketStore((state) => state.emitStopTyping);
	const typingTimeoutRef = useRef(null);

	// Add this function after your state declarations
	const handleTypingIndicator = useCallback(() => {
		if (!conversationId) return;

		// Emit typing start
		emitTyping(conversationId);

		// Clear existing timeout
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}

		// Set timeout to emit stop typing after 3 seconds of inactivity
		typingTimeoutRef.current = setTimeout(() => {
			emitStopTyping(conversationId);
		}, 3000);
	}, [conversationId, emitTyping, emitStopTyping]);

	// Close dropdowns when clicking outside
	useEffect(() => {
		function handleClickOutside(event) {
			// If clicked outside the emoji container, close the emoji picker
			if (emojiRef.current && !emojiRef.current.contains(event.target)) {
				setShowEmojiPicker(false);
			}
			// If clicked outside the attachment container, close the attachment menu
			if (attachmentRef.current && !attachmentRef.current.contains(event.target)) {
				setAttachmentMenuOpen(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	// Focus input when files are selected
	useEffect(() => {
		if (selectedFiles.length > 0 && inputRef.current) {
			inputRef.current.focus();
		}
	}, [selectedFiles.length, inputRef]);

	// File type detection
	const getFileType = (file) => {
		if (file.type.startsWith('image/')) return 'image';
		if (file.type.startsWith('video/')) return 'video';
		if (file.type.includes('pdf')) return 'pdf';
		return 'file';
	};

	// File size formatting
	const formatFileSize = (bytes) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	// File preview component
	const getFilePreviewComponent = (fileObj) => {
		switch (fileObj.type) {
			case 'image':
				return fileObj.preview ? (
					<img src={fileObj.preview} alt={fileObj.name} className="w-full h-full object-cover" />
				) : null;
			case 'video':
				return (
					<div className="w-full h-full bg-black flex items-center justify-center relative">
						{fileObj.preview ? (
							<video className="w-full h-full object-cover" muted>
								<source src={fileObj.preview} />
							</video>
						) : null}
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="w-8 h-8 bg-white bg-opacity-80 rounded-full flex items-center justify-center">
								<Send className="rotate-180 text-black text-lg" />
							</div>
						</div>
						<div className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white text-xs px-1 rounded">
							VIDEO
						</div>
					</div>
				);
			case 'pdf':
				return (
					<div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center p-2 text-gray-900 dark:text-gray-100">
						<FileText className="text-red-600 text-4xl mb-1" />
						<div className="text-xs font-semibold text-center truncate w-full px-1">
							{fileObj.name}
						</div>
						<div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
							{formatFileSize(fileObj.size)}
						</div>
					</div>
				);
			default:
				return (
					<div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center p-2 text-gray-900 dark:text-gray-100">
						<File className="text-gray-600 dark:text-gray-400 text-4xl mb-1" />
						<div className="text-xs font-semibold text-center truncate w-full px-1">
							{fileObj.name}
						</div>
						<div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
							{formatFileSize(fileObj.size)}
						</div>
					</div>
				);
		}
	};

	// Drag and drop handlers
	const handleDragEnter = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		setDragCounter(prev => prev + 1);
		if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
			setIsDragOver(true);
		}
	}, []);

	const handleDragLeave = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		setDragCounter(prev => {
			const newCounter = prev - 1;
			if (newCounter === 0) {
				setIsDragOver(false);
			}
			return newCounter;
		});
	}, []);

	const handleDragOver = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
		setDragCounter(0);

		const files = Array.from(e.dataTransfer.files);
		if (files.length > 0) {
			handleFilesSelected(files);
		}
	}, []);

	// Setup drag and drop listeners
	useEffect(() => {
		document.addEventListener('dragenter', handleDragEnter);
		document.addEventListener('dragleave', handleDragLeave);
		document.addEventListener('dragover', handleDragOver);
		document.addEventListener('drop', handleDrop);

		return () => {
			document.removeEventListener('dragenter', handleDragEnter);
			document.removeEventListener('dragleave', handleDragLeave);
			document.removeEventListener('dragover', handleDragOver);
			document.removeEventListener('drop', handleDrop);
		};
	}, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

	// File selection handler
	const handleFilesSelected = (files) => {
		const validFiles = files.filter(file => {
			if (file.size > 100 * 1024 * 1024) {
				alert(`File "${file.name}" is too large. Maximum size is 100MB.`);
				return false;
			}
			return true;
		});

		if (validFiles.length > 0) {
			const filesWithPreview = validFiles.map(file => {
				let preview = null;
				const fileType = getFileType(file);
				if (fileType === 'image' || fileType === 'video') {
					preview = URL.createObjectURL(file);
				}

				return {
					file,
					id: Math.random().toString(36).substr(2, 9),
					type: fileType,
					preview,
					name: file.name,
					size: file.size,
				};
			});

			setSelectedFiles(prev => [...prev, ...filesWithPreview]);
		}
	};

	// Remove selected file
	const removeSelectedFile = (fileId) => {
		setSelectedFiles(prev => {
			const updated = prev.filter(f => f.id !== fileId);
			const fileToRemove = prev.find(f => f.id === fileId);
			if (fileToRemove && fileToRemove.preview) {
				URL.revokeObjectURL(fileToRemove.preview);
			}
			if (updated.length === 0) {
				setMessageInput('');
			}
			return updated;
		});
	};

	// Prevent double sending with debouncing
	const sendingRef = useRef(false);

	// Handle enhanced send action
	const handleEnhancedSendMessage = () => {
		// Prevent double sending
		if (sendingRef.current) {
			console.log('Already sending, ignoring duplicate send');
			return;
		}

		if (conversationId && typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
			emitStopTyping(conversationId);
		}

		if (selectedFiles.length > 0) {
			// Handle file sending - you can implement your file upload logic here
			console.log('Sending files:', selectedFiles, 'with caption:', messageInput);
			// Clean up
			selectedFiles.forEach(f => {
				if (f.preview) URL.revokeObjectURL(f.preview);
			});
			setSelectedFiles([]);
			setMessageInput('');
		} else if (messageInput.trim()) {
			// Set sending flag to prevent duplicates
			sendingRef.current = true;

			// Use your existing message sending logic but create a mock event
			const mockEvent = { preventDefault: () => { } };

			// Call handleSendMessage (it doesn't return a Promise)
			handleSendMessage(mockEvent);

			// Reset sending flag after a short delay to prevent rapid clicking
			setTimeout(() => {
				sendingRef.current = false;
			}, 1000);
		}
	};

	// Add this useEffect at the end of your component
	useEffect(() => {
		return () => {
			// Cleanup: stop typing when component unmounts
			if (conversationId && typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
				emitStopTyping(conversationId);
			}
		};
	}, [conversationId, emitStopTyping]);

	// Attachment button handlers
	const handleDocumentClick = () => {
		if (documentInputRef.current) {
			documentInputRef.current.click();
		}
		setAttachmentMenuOpen(false);
	};

	const handleDocumentUpload = (e) => {
		const files = Array.from(e.target.files);
		if (files.length > 0) {
			handleFilesSelected(files);
		}
	};

	const handleMediaClick = () => {
		if (imageInputRef.current) {
			imageInputRef.current.click();
		}
		setAttachmentMenuOpen(false);
	};

	const handleMediaUpload = (e) => {
		const files = Array.from(e.target.files);
		if (files.length > 0) {
			handleFilesSelected(files);
		}
	};

	const handleCameraClick = () => {
		if (cameraInputRef.current) {
			cameraInputRef.current.click();
		}
		setAttachmentMenuOpen(false);
	};

	const handleCameraCapture = (e) => {
		const file = e.target.files[0];
		if (file) {
			handleFilesSelected([file]);
		}
	};

	const handlePollClick = () => {
		setShowPollModal(true);
		setAttachmentMenuOpen(false);
	};

	// Poll functions
	const addPollOption = () => {
		if (pollOptions.length < 10) {
			setPollOptions([...pollOptions, '']);
		}
	};

	const removePollOption = (index) => {
		if (pollOptions.length > 2) {
			setPollOptions(pollOptions.filter((_, i) => i !== index));
		}
	};

	const updatePollOption = (index, value) => {
		const newOptions = [...pollOptions];
		newOptions[index] = value;
		setPollOptions(newOptions);
	};

	const handleSendPoll = () => {
		if (!pollQuestion.trim() || pollOptions.filter((opt) => opt.trim()).length < 2) {
			alert('Please provide a question and at least 2 options');
			return;
		}

		const pollData = {
			question: pollQuestion.trim(),
			options: pollOptions.filter((opt) => opt.trim()).map((opt) => ({
				text: opt.trim(),
				votes: [],
			})),
			createdAt: new Date().toISOString(),
		};

		// You can implement your poll sending logic here
		console.log('Sending poll:', pollData);

		setPollQuestion('');
		setPollOptions(['', '']);
		setShowPollModal(false);
	};

	// Attachment options
	const attachmentOptions = [
		{
			icon: FileText,
			label: 'Document',
			color: 'bg-blue-500',
			onClick: handleDocumentClick,
		},
		{
			icon: Image,
			label: 'Photos & Videos',
			color: 'bg-pink-500',
			onClick: handleMediaClick,
		},
		{
			icon: Camera,
			label: 'Camera',
			color: 'bg-red-500',
			onClick: handleCameraClick,
		},
		{
			icon: BarChart3,
			label: 'Poll',
			color: 'bg-yellow-500',
			onClick: handlePollClick,
		},
	];

	return (
		<>
			{/* Drag Overlay */}
			{isDragOver && (
				<div className="fixed inset-0 bg-green-500 bg-opacity-20 flex items-center justify-center z-[200] backdrop-blur-sm pointer-events-none">
					<div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-green-500 max-w-sm mx-4 text-center">
						<div className="w-12 h-12 mx-auto mb-3 bg-green-500 rounded-full flex items-center justify-center">
							<Paperclip className="text-white text-xl" />
						</div>
						<h3 className="text-gray-900 dark:text-white text-lg font-medium mb-1">Drop files here</h3>
						<p className="text-gray-600 dark:text-gray-400 text-sm">Release to add files</p>
					</div>
				</div>
			)}

			{/* File Preview Area */}
			{selectedFiles.length > 0 && (
				<div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 pt-0">
					<div className="flex gap-3 overflow-x-auto py-3 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
						{selectedFiles.map((fileObj) => (
							<div key={fileObj.id} className="relative flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group w-[120px] h-[160px]">
								<button
									onClick={() => removeSelectedFile(fileObj.id)}
									className="absolute top-1 right-1 z-10 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-all"
								>
									<X />
								</button>
								<div className="w-full h-full flex items-center justify-center relative">
									{getFilePreviewComponent(fileObj)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Main Input Area */}
			<div className="relative">
				{/* Message Input Form */}
				<div className="p-4 flex items-end space-x-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">

					{/* 🚀 MODIFICATION START: Emoji Button/Picker container */}
					<div className="relative" ref={emojiRef}>
						<button
							type="button"
							onClick={() => {
								setShowEmojiPicker(prev => !prev);
								if (attachmentMenuOpen) setAttachmentMenuOpen(false); // Close attachment menu on opening emoji
							}}
							className={`p-2 rounded-full transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${showEmojiPicker ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
							aria-label="Toggle emoji picker"
						>
							<Smile className="h-6 w-6 text-gray-500 dark:text-gray-400" />
						</button>

						{/* Emoji Picker Menu */}
						{showEmojiPicker && (
							<div className="absolute bottom-full left-1 mb-4 z-20">
								<div className="transform scale-75 sm:scale-90 md:scale-100 origin-bottom-left">
									<EmojiPicker
										theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
										open={showEmojiPicker}
										onEmojiClick={(emoji) => {
											setMessageInput(prev => prev + emoji.emoji);
											setShowEmojiPicker(false);
											// Focus input after selection for better UX
											if (inputRef.current) {
												inputRef.current.focus();
											}
										}}
										autoFocusSearch={false}
										width={window.innerWidth < 640 ? 380 : 450}
										height={400}
									/>
								</div>
							</div>
						)}
					</div>
					{/* 🚀 MODIFICATION END: Emoji Button/Picker container */}

					{/* Attachment Button with Menu */}
					<div className="relative" ref={attachmentRef}>
						<button
							type="button"
							onClick={() => {
								setAttachmentMenuOpen(prev => !prev);
								if (showEmojiPicker) setShowEmojiPicker(false); // Close emoji picker on opening attachment
							}}
							className={`p-2 rounded-full transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${attachmentMenuOpen ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
							aria-label="Attach file"
						>
							<Paperclip className="h-6 w-6 text-gray-500 dark:text-gray-400" />
						</button>

						{/* Attachment Menu */}
						{attachmentMenuOpen && (
							<div className="absolute bottom-14 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-50 min-w-[200px]">
								{attachmentOptions.map((option, index) => (
									<button
										key={index}
										onClick={(e) => {
											e.stopPropagation();
											option.onClick();
										}}
										className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 text-left"
									>
										<div className={`${option.color} p-2 rounded-full`}>
											<option.icon className="text-white text-lg" />
										</div>
										<span className="text-gray-900 dark:text-white text-sm">{option.label}</span>
									</button>
								))}
							</div>
						)}
					</div>

					{/* Hidden File Inputs */}
					<input
						type="file"
						className="hidden"
						ref={documentInputRef}
						onChange={handleDocumentUpload}
						accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
						multiple
					/>
					<input
						type="file"
						className="hidden"
						ref={imageInputRef}
						onChange={handleMediaUpload}
						accept="image/*,video/*"
						multiple
					/>
					<input
						type="file"
						className="hidden"
						ref={cameraInputRef}
						onChange={handleCameraCapture}
						accept="image/*,video/*"
						capture="environment"
					/>

					{/* Message Input */}
					<div className="flex-1 relative">
						<textarea
							ref={inputRef}
							value={messageInput}
							onChange={e => {
								setMessageInput(e.target.value);
								handleTypingIndicator();
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleEnhancedSendMessage();
								}
							}}
							placeholder={selectedFiles.length > 0 ? "Add a caption..." : "Type a message"}
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
					{messageInput.trim() || selectedFiles.length > 0 ? (
						<button
							type="button"
							onClick={handleEnhancedSendMessage}
							disabled={sendingRef.current}
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

			{/* Poll Creation Modal */}
			{showPollModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
					<div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
						<div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
							<h3 className="text-gray-900 dark:text-white text-lg font-semibold">Create Poll</h3>
							<button
								onClick={() => setShowPollModal(false)}
								className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
							>
								<X className="text-xl" />
							</button>
						</div>

						<div className="p-4 space-y-4">
							{/* Poll Question */}
							<div>
								<label className="text-gray-700 dark:text-gray-300 text-sm block mb-2">Question</label>
								<input
									type="text"
									value={pollQuestion}
									onChange={(e) => setPollQuestion(e.target.value)}
									placeholder="Ask a question..."
									className="w-full p-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-green-500 dark:focus:border-green-400"
									maxLength={200}
								/>
							</div>

							{/* Poll Options */}
							<div>
								<label className="text-gray-700 dark:text-gray-300 text-sm block mb-2">Options</label>
								{pollOptions.map((option, index) => (
									<div key={index} className="flex items-center gap-2 mb-2">
										<input
											type="text"
											value={option}
											onChange={(e) => updatePollOption(index, e.target.value)}
											placeholder={`Option ${index + 1}`}
											className="flex-1 p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-green-500 dark:focus:border-green-400"
											maxLength={100}
										/>
										{pollOptions.length > 2 && (
											<button
												onClick={() => removePollOption(index)}
												className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1"
											>
												<X />
											</button>
										)}
									</div>
								))}

								{pollOptions.length < 10 && (
									<button
										onClick={addPollOption}
										className="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 text-sm font-medium"
									>
										+ Add Option
									</button>
								)}
							</div>

							{/* Action Buttons */}
							<div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
								<button
									onClick={() => setShowPollModal(false)}
									className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={handleSendPoll}
									className="flex-1 p-3 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 rounded-lg text-white font-medium transition-colors"
								>
									Send Poll
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

export default ChatMessageInput;