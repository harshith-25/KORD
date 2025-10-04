import { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import './App.css';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore'; // Ensure theme is initialized too
import { useMessageStore } from './store/messageStore';

function App() {
	useEffect(() => {
		useAuthStore.getState().initializeAuth(); // Initialize auth state
		useThemeStore.getState().initializeTheme(); // Initialize theme
		useMessageStore.getState().initializeStore(); // Initialize message store
	}, []);

	return (
		<div>
			<AppRoutes />
		</div>
	);
}

export default App;