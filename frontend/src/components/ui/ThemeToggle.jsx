// src/components/Common/ThemeToggle.jsx
import React from 'react';
import { useThemeStore } from '@/store/themeStore';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button'; // Using Shadcn button

const ThemeToggle = ({ className }) => {
	const { theme, toggleTheme } = useThemeStore();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={toggleTheme}
			className={className}
			aria-label="Toggle theme"
		>
			{theme === 'dark' ? (
				<SunIcon className="h-6 w-6 text-yellow-500 transition-transform duration-300 transform rotate-0 hover:rotate-45" />
			) : (
				<MoonIcon className="h-6 w-6 text-gray-700 transition-transform duration-300 transform rotate-0 hover:-rotate-45" />
			)}
		</Button>
	);
};

export default ThemeToggle;