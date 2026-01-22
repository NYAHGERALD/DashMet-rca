// API Client Configuration (Firebase)

import axios, { AxiosRequestConfig } from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minutes for AI-powered operations
});

/**
 * Create an axios instance with a custom timeout for long-running AI operations
 * Used for operations like FMIR lock/close which involve AI audit analysis
 */
export function createLongRunningRequest(timeoutMs: number = 180000) {
  return axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: timeoutMs,
  });
}

/**
 * Make an API request with extended timeout for AI-intensive operations
 * Automatically adds Firebase authentication token
 */
export async function apiWithExtendedTimeout<T = any>(
  config: AxiosRequestConfig,
  timeoutMs: number = 180000 // 3 minutes default for AI operations
): Promise<T> {
  const firebaseUser = auth.currentUser;
  let token: string | null = null;

  if (firebaseUser) {
    try {
      token = await firebaseUser.getIdToken();
    } catch (error) {
      console.error('Failed to get Firebase token:', error);
      token = localStorage.getItem('firebaseToken');
    }
  } else {
    token = localStorage.getItem('firebaseToken');
  }

  const instance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api',
    timeout: timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const response = await instance.request<T>(config);
  return response.data;
}

// Request interceptor - Add Firebase token
api.interceptors.request.use(
  async (config) => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      try {
        // Force refresh token if it's been more than 55 minutes (tokens expire in 60 minutes)
        const tokenResult = await firebaseUser.getIdTokenResult();
        const tokenAge = Date.now() - new Date(tokenResult.issuedAtTime).getTime();
        const shouldRefresh = tokenAge > 55 * 60 * 1000; // 55 minutes
        
        const token = await firebaseUser.getIdToken(shouldRefresh);
        localStorage.setItem('firebaseToken', token);
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Failed to get Firebase token:', error);
        // Fallback to stored token if getting fresh token fails
        const storedToken = localStorage.getItem('firebaseToken');
        if (storedToken) {
          config.headers.Authorization = `Bearer ${storedToken}`;
        } else {
          localStorage.removeItem('firebaseToken');
        }
      }
    } else {
      // Firebase auth might not be initialized yet, try using stored token
      const storedToken = localStorage.getItem('firebaseToken');
      if (storedToken) {
        config.headers.Authorization = `Bearer ${storedToken}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        try {
          // Try to refresh the token
          const token = await firebaseUser.getIdToken(true);
          localStorage.setItem('firebaseToken', token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          
          // Retry the original request
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          localStorage.removeItem('firebaseToken');
          await auth.signOut();
          // Only redirect if not already on landing page
          if (typeof window !== 'undefined' && window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }
      } else {
        localStorage.removeItem('firebaseToken');
        // Only redirect if not already on landing page
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }
    
    if (error.response?.status === 429) {
      console.warn('Rate limited, please try again later');
    }
    
    return Promise.reject(error);
  }
);

export default api;
