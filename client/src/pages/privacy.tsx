import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/auth')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
        </div>
        
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-300">Last Updated: April 15, 2023</p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">1. Information We Collect</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Tiger collects the following information:
          </p>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1 mt-2">
            <li>Account information (email address, name, password)</li>
            <li>Task and productivity data you create within the app</li>
            <li>Calendar information when you opt to connect third-party calendars</li>
            <li>Notes and documents you create</li>
            <li>Usage statistics to improve our service</li>
          </ul>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">2. How We Use Your Information</h2>
          <p className="text-gray-600 dark:text-gray-300">
            We use your information to:
          </p>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-1 mt-2">
            <li>Provide, maintain, and improve Tiger services</li>
            <li>Process and complete transactions</li>
            <li>Send service-related communications</li>
            <li>Provide AI-powered features and suggestions</li>
            <li>Analyze usage patterns to enhance user experience</li>
          </ul>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">3. AI Processing</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Tiger uses Gemini AI to provide certain features. Your data may be processed by our AI systems to provide 
            contextual suggestions and assistance. We do not use your personal data to train our AI models without explicit 
            consent.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">4. Data Storage and Security</h2>
          <p className="text-gray-600 dark:text-gray-300">
            We implement reasonable security measures to protect your information. However, no method of transmission or 
            storage is 100% secure. You are responsible for maintaining the security of your account credentials.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">5. Third-Party Integrations</h2>
          <p className="text-gray-600 dark:text-gray-300">
            When you connect third-party services (like calendars), we may exchange data with those services to provide 
            functionality. We do not sell your personal information to third parties.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">6. Your Rights</h2>
          <p className="text-gray-600 dark:text-gray-300">
            You can request access to, correction of, or deletion of your data. You may also request a copy of your data
            or opt-out of certain data collection.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">7. Changes to Privacy Policy</h2>
          <p className="text-gray-600 dark:text-gray-300">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
            Privacy Policy on this page and updating the "Last Updated" date.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">8. Contact Us</h2>
          <p className="text-gray-600 dark:text-gray-300">
            If you have questions about this Privacy Policy, please contact us at privacy@tigerapp.com.
          </p>
        </div>
      </div>
    </div>
  );
} 