'use client';

import { useEffect, useState } from 'react';
import { SupportCategory } from '@/types/support';
import api from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';


const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface SupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SupportModal({ open, onOpenChange }: SupportModalProps) {
  const { user } = useAuth();
  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SupportCategory | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (open && isSystemAdmin) {
      onOpenChange(false);
    }
  }, [open, isSystemAdmin, onOpenChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSystemAdmin) {
      setError('System Admin cannot submit support requests from this form.');
      return;
    }
    if (!subject || !description || !category) {
      setError('All fields are required.');
      return;
    }
    if (!user && !email) {
      setError('Email is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    setSuccess(false);

    try {
      const response = await api.post('/support', {
        subject, 
        description, 
        category,
        email: user ? undefined : email,
      });

      setSuccess(true);
      setSubject('');
      setDescription('');
      setCategory('');
      setEmail('');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a short delay to allow animation to finish
    setTimeout(() => {
        setSuccess(false);
        setError(null);
    }, 300);
  }

  if (!open || isSystemAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop with Blur */}
        <div 
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-md transition-opacity"
          onClick={handleClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl w-full max-w-2xl transform transition-all">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="p-6">
            <h3 className="text-xl font-semibold text-white mb-2">
              Contact Support
            </h3>
            <p className="text-gray-300 mb-6">
              {success
                ? 'Your request has been submitted successfully. We will get back to you shortly.'
                : 'Fill out the form below and we will get back to you as soon as possible.'}
            </p>
            {success ? (
              <div className="py-4 text-center">
                <p className="text-green-400">Thank you for your submission!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {!user && (
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-1">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                      disabled={submitting}
                      required
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-200 mb-1">
                    Subject
                  </label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                    disabled={submitting}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-200 mb-1">
                    Category
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value as SupportCategory)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent [&>option]:bg-slate-800 [&>option]:text-white"
                    disabled={submitting}
                    required
                  >
                    <option value="">Select a category</option>
                    <option value="GENERAL_INQUIRY">General Inquiry</option>
                    <option value="TECHNICAL_ISSUE">Technical Issue</option>
                    <option value="BILLING_QUESTION">Billing Question</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="BUG_REPORT">Bug Report</option>
                    <option value="ACCOUNT_ASSISTANCE">Account Assistance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-200 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                    rows={5}
                    disabled={submitting}
                    required
                  />
                </div>
                
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-white/5 border border-white/20 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 border border-transparent rounded-md hover:from-blue-700 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 transition-all shadow-lg"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
