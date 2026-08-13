import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.jsx';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key in .env.local");
}

const localization = {
  signUp: {
    start: {
      title: 'Sign up for MySongChart',
      subtitle: '',
      actionText: 'Already have an account?',
      actionLink: 'Sign in'
    }
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/" localization={localization}>
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);
