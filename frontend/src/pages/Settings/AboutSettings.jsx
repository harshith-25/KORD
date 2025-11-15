import { ChevronsRight } from 'lucide-react';

const AboutSettings = () => (
  <div className="h-full overflow-y-auto">
    <div className="bg-green-600 dark:bg-green-700 px-6 py-4">
      <h3 className="text-xl font-medium text-white">About</h3>
    </div>
    <div className="p-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-white">K</span>
        </div>
        <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Kord</h4>
        <p className="text-gray-600 dark:text-gray-400">Version 1.0.0 (Beta)</p>
      </div>
      <div className="space-y-4 mb-8">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Build Date:</strong> June 24, 2025
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Developer:</strong> Harshith S Shetty
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <a href="#" className="flex items-center text-green-600 dark:text-green-400 hover:underline">
          <ChevronsRight className="h-4 w-4 mr-2" /> Terms of Service
        </a>
        <a href="#" className="flex items-center text-green-600 dark:text-green-400 hover:underline">
          <ChevronsRight className="h-4 w-4 mr-2" /> Privacy Policy
        </a>
        <a href="#" className="flex items-center text-green-600 dark:text-green-400 hover:underline">
          <ChevronsRight className="h-4 w-4 mr-2" /> Help Center
        </a>
        <a href="#" className="flex items-center text-green-600 dark:text-green-400 hover:underline">
          <ChevronsRight className="h-4 w-4 mr-2" /> Contact Us
        </a>
      </div>
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          © 2025 Kord Team. All rights reserved.
        </p>
      </div>
    </div>
  </div>
);

export default AboutSettings;