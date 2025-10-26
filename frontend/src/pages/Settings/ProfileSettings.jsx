import { useState, useEffect, useRef } from 'react';
import api from '@/utils/axiosInstance';
import {
	UPDATE_USER_PROFILE_ROUTE,
	UPDATE_PROFILE_IMAGE_ROUTE,
	DELETE_PROFILE_IMAGE_ROUTE
} from '@/utils/ApiRoutes';
import { User, CheckCircle, XCircle, Image, Trash2 } from 'lucide-react';

const ProfileSettings = ({ user, updateAuthStoreUser, setLoading, setError }) => {
	const [firstName, setFirstName] = useState(user?.firstName || '');
	const [lastName, setLastName] = useState(user?.lastName || '');
	const [email, setEmail] = useState(user?.email || '');
	const [statusMessage, setStatusMessage] = useState(user?.bio || '');
	const [profileImageFile, setProfileImageFile] = useState(null);
	const [imagePreview, setImagePreview] = useState(user?.image || '');
	const fileInputRef = useRef(null);
	const [formMessage, setFormMessage] = useState({ type: '', text: '' });

	useEffect(() => {
		if (user) {
			setFirstName(user.firstName || '');
			setLastName(user.lastName || '');
			setEmail(user.email || '');
			setStatusMessage(user.bio || '');
			setImagePreview(user.image || '');
		}
	}, [user]);

	const handleFileChange = (e) => {
		const file = e.target.files[0];
		if (file) {
			setProfileImageFile(file);
			setImagePreview(URL.createObjectURL(file));
			setFormMessage({ type: '', text: '' });
		}
	};

	const handleImageUpload = async () => {
		if (!profileImageFile) {
			setFormMessage({ type: 'error', text: 'Please select an image to upload.' });
			return;
		}
		setLoading(true);
		setFormMessage({ type: '', text: '' });
		try {
			const formData = new FormData();
			formData.append('profileImage', profileImageFile);
			const response = await api.post(UPDATE_PROFILE_IMAGE_ROUTE, formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			});
			setFormMessage({ type: 'success', text: response.data.message || 'Profile image updated successfully!' });
			updateAuthStoreUser(response.data.user);
			setProfileImageFile(null);
			if (fileInputRef.current) fileInputRef.current.value = '';
		} catch (err) {
			const msg = err.response?.data?.message || 'Failed to update profile image.';
			setFormMessage({ type: 'error', text: msg });
			setError(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteImage = async () => {
		if (!user?.image) {
			setFormMessage({ type: 'error', text: 'No profile image to delete.' });
			return;
		}
		setLoading(true);
		setFormMessage({ type: '', text: '' });
		try {
			const response = await api.delete(DELETE_PROFILE_IMAGE_ROUTE);
			setFormMessage({ type: 'success', text: response.data.message || 'Profile image deleted successfully!' });
			updateAuthStoreUser(response.data.user || { ...user, image: null });
			setImagePreview('');
		} catch (err) {
			const msg = err.response?.data?.message || 'Failed to delete profile image.';
			setFormMessage({ type: 'error', text: msg });
			setError(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateProfile = async (e) => {
		e.preventDefault();
		setLoading(true);
		setFormMessage({ type: '', text: '' });
		try {
			const response = await api.put(UPDATE_USER_PROFILE_ROUTE, {
				firstName,
				lastName,
				email,
				bio: statusMessage,
			});
			setFormMessage({ type: 'success', text: response.data.message || 'Profile updated successfully!' });
			updateAuthStoreUser(response.data.user);
		} catch (err) {
			const msg = err.response?.data?.message || 'Failed to update profile.';
			setFormMessage({ type: 'error', text: msg });
			setError(msg);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="h-full overflow-y-auto">
			<div className="bg-green-600 dark:bg-green-700 px-6 py-4">
				<h3 className="text-xl font-medium text-white">Profile</h3>
			</div>
			<div className="p-6">
				{formMessage.text && (
					<div className={`p-3 rounded-md mb-4 flex items-center ${formMessage.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
						{formMessage.type === 'success' ? <CheckCircle className="h-5 w-5 mr-2" /> : <XCircle className="h-5 w-5 mr-2" />}
						{formMessage.text}
					</div>
				)}
				<div className="flex flex-col items-center mb-8">
					<div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4">
						{imagePreview ? (
							<img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
						) : (
							<User className="w-20 h-20 text-gray-400 dark:text-gray-500" />
						)}
						<input
							type="file"
							ref={fileInputRef}
							accept="image/*"
							onChange={handleFileChange}
							className="absolute inset-0 opacity-0 cursor-pointer"
							title="Change profile image"
						/>
					</div>
					<div className="flex space-x-2">
						<button
							onClick={handleImageUpload}
							className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 text-sm"
							disabled={!profileImageFile}
						>
							<Image className="h-4 w-4 mr-1" /> Upload
						</button>
						<button
							onClick={handleDeleteImage}
							className="flex items-center px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200 text-sm"
							disabled={!user?.image}
						>
							<Trash2 className="h-4 w-4 mr-1" /> Delete
						</button>
					</div>
				</div>
				<form onSubmit={handleUpdateProfile} className="space-y-4">
					<div>
						<label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Name</label>
						<input
							type="text"
							id="firstName"
							value={firstName}
							onChange={(e) => setFirstName(e.target.value)}
							className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
						/>
					</div>
					<div>
						<label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Name</label>
						<input
							type="text"
							id="lastName"
							value={lastName}
							onChange={(e) => setLastName(e.target.value)}
							className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
						/>
					</div>
					<div>
						<label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
						<input
							type="email"
							id="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
							disabled
						/>
					</div>
					<div>
						<label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bio</label>
						<input
							type="text"
							id="status"
							value={statusMessage}
							onChange={(e) => setStatusMessage(e.target.value)}
							className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
							maxLength={100}
						/>
					</div>
					<button
						type="submit"
						className="w-full py-3 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 font-medium"
					>
						Save Changes
					</button>
				</form>
			</div>
		</div>
	);
};

export default ProfileSettings;