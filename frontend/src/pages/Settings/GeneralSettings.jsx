import React from 'react';
import { Settings } from 'lucide-react';

const ToggleSwitch = ({ label, checked, onChange, description }) => (
	<div className="flex items-center justify-between py-4 px-6 border-b border-gray-200 dark:border-gray-700">
		<div className="flex-1">
			<label className="text-gray-800 dark:text-gray-100 font-normal cursor-pointer block">
				{label}
			</label>
			{description && (
				<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
			)}
		</div>
		<label className="relative inline-flex items-center cursor-pointer ml-4">
			<input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
			<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
		</label>
	</div>
);

const GeneralSettings = ({ toggleTheme, theme }) => (
	<div className="h-full overflow-y-auto">
		<div className="bg-green-600 dark:bg-green-700 px-6 py-4">
			<h3 className="text-xl font-medium text-white">General</h3>
		</div>
		<div>
			<div className="px-6 py-2 bg-gray-50 dark:bg-gray-800">
				<p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Appearance</p>
			</div>
			<ToggleSwitch
				label="Dark Mode"
				checked={theme === 'dark'}
				onChange={toggleTheme}
				description="Switch between light and dark themes"
			/>
			<div className="px-6 py-2 bg-gray-50 dark:bg-gray-800 mt-6">
				<p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">App Settings</p>
			</div>
			<ToggleSwitch
				label="Start Kord at Login"
				checked={false}
				onChange={() => console.log('Toggle Start at Login')}
				description="Automatically launch Kord when you log in"
			/>
			<ToggleSwitch
				label="Enable Message Sounds"
				checked={true}
				onChange={() => console.log('Toggle Message Sounds')}
				description="Play sound when new messages arrive"
			/>
			<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<p className="font-medium text-gray-800 dark:text-gray-200 mb-1">Language</p>
				<select className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500">
					<option>English (US)</option>
					<option>Spanish</option>
					<option>French</option>
					<option>German</option>
				</select>
			</div>
		</div>
	</div>
);

export default GeneralSettings;