import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../firebase';
import '../styles/Signup.css';
import Login from "../pages/Login";

/**
 * SIGNUP PAGE COMPONENT (Updated by Tanvir)
 * - Changed from single "Full Name" field to separate "First Name" and "Last Name" fields
 * - Maintains two-column layout with form on left, info panel on right
 * - Features email verification and Google sign-up option
 */
function Signup() {
  const navigate = useNavigate();
  // TANVIR: Split formData to include separate firstName and lastName fields
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const googleProvider = new GoogleAuthProvider();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // created function to handle Google sign-up logic on 2/11 similar to the login.jsx
  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      // Google accounts are already verified
      const idToken = await user.getIdToken();
      // Call the onSignup prop if available, or navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      // handling errors for Google sign-up
      let errorMessage = 'Google sign-up failed. Please try again.';
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-up was cancelled.';
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email.';
      }
      setErrors({
        submit: errorMessage
      });
      // Log the error for debugging purposes
      console.error('Google sign-up error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // TANVIR: Validate firstName field
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    // TANVIR: Validate lastName field
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      // Create user with Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // TANVIR: Combine first and last name for display name in Firebase auth
      const fullName = `${formData.firstName} ${formData.lastName}`;
      await updateProfile(userCredential.user, {
        displayName: fullName
      });

      // Send email verification
      await sendEmailVerification(userCredential.user);

      // Log out the user immediately after signup to enforce email verification
      await signOut(auth); 

      // Clear form with updated field names
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
      setErrors({});

      // Show success message
      alert('Account created successfully! Please check your email to verify your account before logging in.');
      
      navigate('/login');
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to create account. Please try again.';
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      
      setErrors({
        submit: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  // UI for the signup page with form fields, error handling, and Google sign-up option
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p className="auth-subtitle">Join ContentFlow AI to automate your content workflow</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          {/* TANVIR: Split name field into firstName and lastName */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                className={errors.firstName ? 'input-error' : ''}
              />
              {errors.firstName && <span className="error-message">{errors.firstName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                className={errors.lastName ? 'input-error' : ''}
              />
              {errors.lastName && <span className="error-message">{errors.lastName}</span>}
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@contentflow.ai"
              className={errors.email ? 'input-error' : ''}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="ContentFlow123!"
              className={errors.password ? 'input-error' : ''}
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="ContentFlow123!"
              className={errors.confirmPassword ? 'input-error' : ''}
            />
            {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
          </div>
          
          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        
        <div className="oauth-separator">OR</div>

        <div className="oauth-buttons">
          <button 
            type="button"
            className="oauth-btn google-btn"
            onClick={handleGoogleSignUp}
            disabled={isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>
        </div>
        
        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button 
              type="button"
              onClick={() => navigate('/login')} 
              className="auth-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
              Sign in here
            </button>
          </p>
          
          {errors.submit && <span className="error-message">{errors.submit}</span>}
          
          <div className="terms-text">
            By creating an account, you agree to our{' '}
            <a href="/terms" className="terms-link">Terms of Service</a> and{' '}
            <a href="/privacy" className="terms-link">Privacy Policy</a>
          </div>
          
        </div>
        
      </div>
      <div className="auth-side-panel">
        <h2>Start Automating Your Content Workflow</h2>
        <ul className="features-list">
          <li>AI-powered content generation</li>
          <li> Multi-stage workflow management</li>
          <li>Real-time collaboration</li>
          <li> Analytics dashboard</li>
          <li> Gemini API integration</li>
        </ul>
        
        <div className="testimonial">
          <p>"ContentFlow AI cut our content production time by 70%"</p>
          <small>- Marketing Team Lead</small>
        </div>
      </div>
    </div>
  );
}

export default Signup;