
const AuthLayout = ({ children }) => {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
			<div className="bg-secondary-bg p-8 rounded-lg shadow-xl w-full max-w-md">
				{children}
			</div>
		</div>
	);
};

export default AuthLayout;