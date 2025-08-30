import React from 'react';
import { cn } from '@/utils/utils';

const MessageBubble = ({ message, isOwnMessage, className }) => {
	const bubbleClass = isOwnMessage
		? "bg-blue-500 text-white rounded-br-none self-end"
		: "bg-gray-700 text-text-light rounded-bl-none self-start";

	return (
		<div className={cn("max-w-[70%] p-3 rounded-lg my-1", bubbleClass, className)}>
			<p>{message.text}</p>
			{message.file && (
				<a href={message.file} target="_blank" rel="noopener noreferrer" className="text-blue-200 hover:underline text-sm mt-1 block">
					View File
				</a>
			)}
			<span className="text-xs opacity-75 mt-1 block text-right">
				{new Date(message.timestamp).toLocaleTimeString()}
			</span>
		</div>
	);
};

export default MessageBubble;