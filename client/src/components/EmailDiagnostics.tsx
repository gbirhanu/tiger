import React, { useState } from 'react';
import axios from 'axios';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface DiagnosticResult {
  success: boolean;
  timestamp: string;
  environment: {
    EMAIL_HOST: string;
    EMAIL_PORT: string;
    EMAIL_USER: string;
    EMAIL_PASS: string;
    EMAIL_FROM: string;
    EMAIL_SECURE: string;
    APP_URL: string;
  };
  user: { 
    exists: boolean;
    name: string;
  };
  database: {
    scheduled_notifications: boolean;
    hasRecords: boolean;
    recordCount: number;
  };
  emailService: {
    initialized: boolean;
    config: Record<string, any>;
    usingEthereal: boolean;
  };
  testEmail: {
    sent: boolean;
    recipient: string;
    error: any;
    result: any;
  };
  recommendedActions: string[];
}

const EmailDiagnostics: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('/api/email/diagnose', { email });
      setResult(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while running diagnostics');
      console.error('Email diagnostics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ status }: { status: boolean | string }) => {
    const isSuccess = status === true || status === '✓';
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {isSuccess ? 
          <CheckCircleIcon className="mr-1 h-4 w-4 text-green-500" /> : 
          <XCircleIcon className="mr-1 h-4 w-4 text-red-500" />}
        {isSuccess ? 'OK' : 'Issue'}
      </span>
    );
  };

  return (
    <div className="bg-white shadow sm:rounded-lg p-4 mb-8">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Email System Diagnostics</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Test your email configuration and identify potential issues
        </p>
      </div>

      <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
        <div className="sm:flex sm:items-start">
          <div className="w-full">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address to test
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="email"
                name="email"
                id="email"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="button"
                onClick={runDiagnostics}
                disabled={loading}
                className="ml-3 inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {loading ? 'Running...' : 'Run Diagnostics'}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>

        {result && (
          <div className="mt-6">
            <div className="rounded-md bg-blue-50 p-4 mb-6">
              <div className="flex">
                <div className="ml-3 flex-1 md:flex md:justify-between">
                  <p className="text-sm text-blue-700">
                    Diagnostic completed at {new Date(result.timestamp).toLocaleString()}
                  </p>
                  <p className="mt-3 text-sm md:mt-0 md:ml-6">
                    <span className={`font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                      {result.success ? 'All systems OK' : 'Issues detected'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Component</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {/* Environment Section */}
                  <tr>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">Environment Variables</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <StatusBadge status={
                        result.environment.EMAIL_HOST === '✓' && 
                        result.environment.EMAIL_PORT === '✓' && 
                        result.environment.EMAIL_USER === '✓' && 
                        result.environment.EMAIL_PASS === '✓'
                      } />
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>EMAIL_HOST: {result.environment.EMAIL_HOST}</li>
                        <li>EMAIL_PORT: {result.environment.EMAIL_PORT}</li>
                        <li>EMAIL_USER: {result.environment.EMAIL_USER}</li>
                        <li>EMAIL_PASS: {result.environment.EMAIL_PASS}</li>
                        <li>EMAIL_FROM: {result.environment.EMAIL_FROM}</li>
                      </ul>
                    </td>
                  </tr>
                  
                  {/* User Section */}
                  <tr>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">User Check</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <StatusBadge status={result.user.exists} />
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {result.user.exists 
                        ? `User found with name: ${result.user.name}` 
                        : "User with this email address was not found in the database"}
                    </td>
                  </tr>
                  
                  {/* Database Section */}
                  <tr>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">Database Tables</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <StatusBadge status={result.database.scheduled_notifications} />
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {result.database.scheduled_notifications 
                        ? `Scheduled notifications table exists with ${result.database.recordCount} records` 
                        : "Scheduled notifications table not found"}
                    </td>
                  </tr>
                  
                  {/* Email Service Section */}
                  <tr>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">Email Service</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <StatusBadge status={result.emailService.initialized} />
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      <div>
                        <p>{result.emailService.initialized 
                          ? `Service initialized with ${result.emailService.usingEthereal ? 'Ethereal (test)' : 'production'} credentials` 
                          : "Failed to initialize email service"}</p>
                        
                        {result.emailService.config.host && (
                          <div className="mt-2">
                            <p className="font-medium">Configuration:</p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li>Host: {result.emailService.config.host}</li>
                              <li>Port: {result.emailService.config.port}</li>
                              <li>Secure: {result.emailService.config.secure ? 'Yes' : 'No'}</li>
                              <li>Auth: {result.emailService.config.auth}</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Test Email Section */}
                  <tr>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">Test Email</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <StatusBadge status={result.testEmail.sent} />
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {result.testEmail.sent 
                        ? `Test email successfully sent to ${result.testEmail.recipient}` 
                        : "Failed to send test email"}
                      
                      {result.testEmail.error && (
                        <div className="mt-2">
                          <p className="font-medium text-red-600">Error Details:</p>
                          <pre className="mt-1 text-xs bg-red-50 p-2 rounded overflow-auto max-h-24">
                            {typeof result.testEmail.error === 'object' 
                              ? JSON.stringify(result.testEmail.error, null, 2) 
                              : result.testEmail.error}
                          </pre>
                        </div>
                      )}
                      
                      {result.testEmail.result && (
                        <div className="mt-2">
                          <p className="font-medium text-green-600">Send Result:</p>
                          <pre className="mt-1 text-xs bg-green-50 p-2 rounded overflow-auto max-h-24">
                            {typeof result.testEmail.result === 'object' 
                              ? JSON.stringify(result.testEmail.result, null, 2) 
                              : result.testEmail.result}
                          </pre>
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {result.recommendedActions && result.recommendedActions.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900">Recommended Actions</h4>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-gray-700">
                  {result.recommendedActions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailDiagnostics; 