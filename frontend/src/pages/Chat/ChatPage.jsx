// frontend/src/pages/ChatPage.jsx

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useParams and useNavigate
import ChatMainPanel from '@/pages/Chat/ChatMainPanel';
import { useChatStore } from '@/store/chatStore';

const ChatPage = () => {
	const { chatId } = useParams(); // Get chatId from URL parameters
	const navigate = useNavigate();
	const { setSelectedChat, contacts, selectedChatId } = useChatStore();

	useEffect(() => {
		// If a chatId is in the URL, set it as the selected chat in the store
		if (chatId && chatId !== selectedChatId) {
			setSelectedChat(chatId);
		} else if (!chatId && selectedChatId) {
			// If no chatId in URL but one is selected in store, navigate to it
			navigate(`/chat/${selectedChatId}`, { replace: true });
		} else if (!chatId && !selectedChatId && contacts.length > 0) {
			// If no chat selected and no chatId in URL, but contacts exist, select the first one
			setSelectedChat(contacts[0].id);
			navigate(`/chat/${contacts[0].id}`, { replace: true });
		}
	}, [chatId, setSelectedChat, selectedChatId, navigate, contacts]);

	// ChatMainPanel will render the empty state if no chat is selected,
	// or the actual chat view if selectedChatId is set by the useEffect.
	return <ChatMainPanel />;
};

export default ChatPage;