import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
        </div>
        
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-300">Last Updated: April 15, 2023</p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">1. Acceptance of Terms</h2>
          <p className="text-gray-600 dark:text-gray-300">
            By accessing or using Tiger, you agree to be bound by these Terms of Service and all applicable laws and regulations. 
            If you do not agree with any of these terms, you are prohibited from using this service.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">2. Use License</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Permission is granted to temporarily use Tiger for personal, non-commercial productivity purposes. 
            This license does not include: modifying or copying the materials; using the materials for any commercial purpose; 
            attempting to decompile or reverse engineer any software contained in Tiger.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">3. User Accounts</h2>
          <p className="text-gray-600 dark:text-gray-300">
            To access certain features of Tiger, you must register for an account. You are responsible for maintaining the 
            confidentiality of your account information and for all activities under your account.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">4. AI Features</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Tiger provides AI-assisted features powered by Gemini. User content may be processed by our AI systems to 
            provide suggestions and assistance. We do not use your data to train our AI models without explicit consent.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">5. Data Storage</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Tiger stores your tasks, notes, and calendar data. You retain all rights to your content. We implement 
            reasonable security measures but cannot guarantee absolute security.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">6. Limitations</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Tiger shall not be held liable for any damages arising from the use of our service. This includes but is not limited to 
            direct, indirect, incidental, or consequential damages.
          </p>
          
          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white">7. Termination</h2>
          <p className="text-gray-600 dark:text-gray-300">
            We may terminate or suspend your account at any time without prior notice for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.
          </p>
        </div>
      </div>
    </div>
  );
} 