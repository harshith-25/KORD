import { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import './App.css';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore'; // Ensure theme is initialized too

function App() {
	useEffect(() => {
		useAuthStore.getState().initializeAuth(); // Initialize auth state
		useThemeStore.getState().initializeTheme(); // Initialize theme
	}, []);

	return (
		<div>
			<AppRoutes />
		</div>
	);
}

export default App;