import React from 'react';
import { cn } from '@/utils/utils';

const LoadingSpinner = ({ className }) => {
	return (
		<div className={cn("flex justify-center items-center", className)}>
			<div className="w-8 h-8 border-4 border-t-4 border-gray-200 border-t-accent-color rounded-full animate-spin"></div>
		</div>
	);
};

export default LoadingSpinner;