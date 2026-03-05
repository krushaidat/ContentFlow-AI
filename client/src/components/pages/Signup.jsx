import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../firebase';
import '../styles/Signup.css';
import Login from "../pages/Login";
import {AiOutlineEye, AiOutlineEyeInvisible} from 'react-icons/ai'

/**
 * SIGNUP PAGE COMPONENT (Updated by Tanvir)
 * - Changed from single "Full Name" field to separate "First Name" and "Last Name" fields
 * - First name and last name limited to 20 characters max
 * - Password requirements: min 8 chars, 1 uppercase, 1 special character
 * - Password info tooltip icon showing requirements
 * - Password show/hide toggle
 * - Maintains two-column layout with form on left, info panel on right
 * - Features email verification and Google sign-up option
 */
function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef(null);
  const infoIconRef = useRef(null);
  const googleProvider = new GoogleAuthProvider();

  // State for toggling visibility of password fields
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };
  
  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target) &&
        infoIconRef.current &&
        !infoIconRef.current.contains(e.target)
      ) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Enforce 20 character max for first and last name
    if ((name === 'firstName' || name === 'lastName') && value.length > 20) return;

    setFormData({ ...formData, [name]: value });
  };

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    setErrors({});
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      await user.getIdToken();
      navigate('/dashboard');
    } catch (err) {
      let errorMessage = 'Google sign-up failed. Please try again.';
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-up was cancelled.';
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email.';
      }
      setErrors({ submit: errorMessage });
      console.error('Google sign-up error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Password requirement checkers
  const passwordChecks = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    special: /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;'/]/.test(formData.password),
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.length > 20) {
      newErrors.firstName = 'First name cannot exceed 20 characters';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.length > 20) {
      newErrors.lastName = 'Last name cannot exceed 20 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!passwordChecks.length) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!passwordChecks.uppercase) {
      newErrors.password = 'Password must contain at least 1 uppercase letter';
    } else if (!passwordChecks.special) {
      newErrors.password = 'Password must contain at least 1 special character';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.confirmPassword.length < 8) {
      newErrors.confirmPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.confirmPassword)) {
      newErrors.confirmPassword = 'Password must contain at least 1 uppercase letter';
    } else if (!/[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;'/]/.test(formData.confirmPassword)) {
      newErrors.confirmPassword = 'Password must contain at least 1 special character';
    } else if (formData.password !== formData.confirmPassword) {
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
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const fullName = `${formData.firstName} ${formData.lastName}`;
      await updateProfile(userCredential.user, { displayName: fullName });
      await sendEmailVerification(userCredential.user);
      await signOut(auth);

      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
      });

      setErrors({});

      alert('Account created successfully! Please check your email to verify your account before logging in.');
      navigate('/login');
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to create account. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      setErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };


  // All password requirements met for both fields
  const confirmPasswordChecks = {
    length: formData.confirmPassword.length >= 8,
    uppercase: /[A-Z]/.test(formData.confirmPassword),
    special: /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;'/]/.test(formData.confirmPassword),
    matches: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0,
  };

  const allPasswordRequirementsMet =
    passwordChecks.length &&
    passwordChecks.uppercase &&
    passwordChecks.special &&
    confirmPasswordChecks.length &&
    confirmPasswordChecks.uppercase &&
    confirmPasswordChecks.special &&
    confirmPasswordChecks.matches;

  // Eye icon SVGs for show/hide password toggle
  const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  const EyeOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p className="auth-subtitle">Join ContentFlow AI to automate your content workflow</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* First Name & Last Name - 20 char max */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="firstName">
                First Name
                <span style={{ fontSize: '11px', color: '#999', marginLeft: '6px', fontWeight: 'normal' }}>
                  ({formData.firstName.length}/20)
                </span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                maxLength={20}
                className={errors.firstName ? 'input-error' : ''}
              />
              {errors.firstName && <span className="error-message">{errors.firstName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="lastName">
                Last Name
                <span style={{ fontSize: '11px', color: '#999', marginLeft: '6px', fontWeight: 'normal' }}>
                  ({formData.lastName.length}/20)
                </span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                maxLength={20}
                className={errors.lastName ? 'input-error' : ''}
              />
              {errors.lastName && <span className="error-message">{errors.lastName}</span>}
            </div>
          </div>

          {/* Email */}
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

          {/* Password with info icon tooltip */}
          <div className="form-group">
            <label htmlFor="password" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Password
              {/* Info icon */}
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <button
                  type="button"
                  ref={infoIconRef}
                  onClick={() => setShowTooltip((prev) => !prev)}
                  aria-label="Password requirements"
                  style={{
                    background: 'none',
                    border: '1.5px solid #888',
                    borderRadius: '50%',
                    width: '17px',
                    height: '17px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#666',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    lineHeight: 1,
                  }}
                >
                  i
                </button>

                {/* Tooltip card */}
                {showTooltip && (
                  <div
                    ref={tooltipRef}
                    style={{
                      position: 'absolute',
                      bottom: '130%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '10px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
                      padding: '14px 18px',
                      minWidth: '230px',
                      zIndex: 100,
                      fontSize: '13px',
                      color: '#222',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Passwords must contain:</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'disc' }}>
                      <RequirementItem met={passwordChecks.length} text="A minimum of 8 characters" />
                      <RequirementItem met={passwordChecks.uppercase} text="At least 1 uppercase letter" />
                      <RequirementItem met={passwordChecks.special} text="At least 1 special character" />
                    </ul>
                    {/* Tooltip arrow */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-8px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderTop: '8px solid #ddd',
                    }} />
                    <div style={{
                      position: 'absolute',
                      bottom: '-7px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '7px solid transparent',
                      borderRight: '7px solid transparent',
                      borderTop: '7px solid #fff',
                    }} />
                  </div>
                )}
              </span>
            </label>

            {/* Password input with show/hide toggle */}
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password"
                className={errors.password ? 'input-error' : ''}
                style={{ paddingRight: '42px', width: '100%', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#888',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}

            {/* Live requirement indicators (shown while typing) */}
            {formData.password.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <RequirementRow met={passwordChecks.length} text="At least 8 characters" />
                <RequirementRow met={passwordChecks.uppercase} text="At least 1 uppercase letter" />
                <RequirementRow met={passwordChecks.special} text="At least 1 special character" />
              </div>
            )}
          </div>

          {/* Confirm Password with show/hide toggle + live match indicator */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                className={errors.confirmPassword ? 'input-error' : ''}
                style={{ paddingRight: '42px', width: '100%', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#888',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}

            {/* Live confirm password requirement rows */}
            {formData.confirmPassword.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <RequirementRow met={confirmPasswordChecks.length} text="At least 8 characters" />
                <RequirementRow met={confirmPasswordChecks.uppercase} text="At least 1 uppercase letter" />
                <RequirementRow met={confirmPasswordChecks.special} text="At least 1 special character" />
                <RequirementRow met={confirmPasswordChecks.matches} text="Passwords match" />
              </div>
            )}
          </div>

          <button type="submit" className="auth-button" disabled={isLoading || !allPasswordRequirementsMet}>
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
          <li>Multi-stage workflow management</li>
          <li>Real-time collaboration</li>
          <li>Analytics dashboard</li>
          <li>Gemini API integration</li>
        </ul>

        <div className="testimonial">
          <p>"ContentFlow AI cut our content production time by 70%"</p>
          <small>- Marketing Team Lead</small>
        </div>
      </div>
    </div>
  );
}

// Tooltip list item with live green/grey check
function RequirementItem({ met, text }) {
  return (
    <li style={{ color: met ? '#22a06b' : '#444', marginBottom: '3px' }}>
      {text}
    </li>
  );
}

// Inline live requirement row shown below the password field while typing
function RequirementRow({ met, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: met ? '#22a06b' : '#999' }}>
      <span style={{ fontSize: '14px' }}>{met ? '✓' : '○'}</span>
      {text}
    </div>
  );
}

export default Signup;