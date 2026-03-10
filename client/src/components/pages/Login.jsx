import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../../firebase";
import { db } from "../../firebase";
import useInPageAlert from "../../hooks/useInPageAlert";
import { setDoc, doc, getDoc } from "firebase/firestore";
import InPageAlert from "../InPageAlert";
import "../styles/login.css";
import {AiOutlineEye, AiOutlineEyeInvisible} from 'react-icons/ai'

/*
 * LOGIN PAGE COMPONENT (Updated by Tanvir)
  - Redesigned with modern two-column layout for better UI consistency with Signup page
  - Info panel positioned on left side, form on right side (opposite of Signup for variety)
  - Features email verification check and password reset functionality remained the same
  - Password field now has eye icon show/hide toggle (replaces text button)
  - Password requirement cards shown live as user types (matches Signup page behavior)
 */

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

// Inline live requirement row shown below the password field while typing
function RequirementRow({ met, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: met ? '#22a06b' : '#999' }}>
      <span style={{ fontSize: '14px' }}>{met ? '✓' : '○'}</span>
      {text}
    </div>
  );
}

// Tooltip list item with live green/grey indicator
function RequirementItem({ met, text }) {
  return (
    <li style={{ color: met ? '#22a06b' : '#444', marginBottom: '3px' }}>
      {text}
    </li>
  );
}

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState(null);
  const [forgotMessage, setForgotMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { alertState, showAlert, dismissAlert } = useInPageAlert();

  const tooltipRef = useRef(null);
  const infoIconRef = useRef(null);
  const googleProvider = new GoogleAuthProvider();

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

  // Live password requirement checks
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;'/]/.test(password),
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setShowResendVerification(false);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      
      // Create or update user profile document in Firestore
      const userDocRef = doc(db, "Users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      const nameParts = (user.displayName || '').split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const userData = {
        email: user.email.toLowerCase(),
        firstName: firstName,
        lastName: lastName,
        displayName: user.displayName || user.email,
      };
      
      // Only add role if user document doesn't exist (new user)
      if (!userDocSnap.exists()) {
        userData.role = "user";
        userData.createdAt = new Date();
      }
      
      await setDoc(userDocRef, userData, { merge: true }); // merge: true preserves existing fields like role
      
      const idToken = await user.getIdToken();
      onLogin({ uid: user.uid, email: user.email, token: idToken });
    } catch (err) {
      setError("Google login failed. Please try again.");
      console.error("Google login error:", err);
    } finally {
      setLoading(false);
    }
  };

  /** DRAVEN
   * Handles resending the email verification to the user.
   * This function is triggered when the user clicks the "Resend verification email" button after a failed login attempt due to unverified email.
   * It uses Firebase's sendEmailVerification function to send a new verification email to the user's email address.
   */
  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    try {
      await sendEmailVerification(unverifiedUser);
      showAlert("Verification email sent!", "success");
      setShowResendVerification(false);
    } catch (err) {
      console.error("Error resending verification email:", err);
      setError("Failed to resend verification email. Please try again later.");
    }
  };

  /** DRAVEN
   * Handles the submission of the login form.
   * @param {*} e - The event object.
   * @returns {Promise<void>} - A promise that resolves when the form is submitted.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        setError("Email not verified. Please check your inbox.");
        setShowResendVerification(true);
        setUnverifiedUser(user);
        await auth.signOut();
        setLoading(false);
        return;
      }

      // Ensure user profile exists in Firestore
      const userDocRef = doc(db, "Users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      const nameParts = (user.displayName || '').split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Only set role to "user" if this is a new user (no existing document)
      const userData = {
        email: user.email.toLowerCase(),
        firstName: firstName,
        lastName: lastName,
        displayName: user.displayName || user.email,
      };
      
      // Only add role if user document doesn't exist (new user)
      if (!userDocSnap.exists()) {
        userData.role = "user";
        userData.createdAt = new Date();
      }
      
      await setDoc(userDocRef, userData, { merge: true }); // merge: true preserves existing fields like role

      const idToken = await user.getIdToken();
      onLogin({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "",
        token: idToken,
      });
    } catch (err) {
      let errorMessage = "Login failed. Please try again.";
      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (err.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many failed login attempts. Please try again later.";
      }
      setError(errorMessage);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  /** DRAVEN
   * Toggles the visibility of the password input field.
   * When the user clicks the "Show" or "Hide" button next to the password field, this function is called to switch between showing the password as plain text or masking it.
   * It updates the showPassword state variable, which controls the type of the password input field (text or password).
   */
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  /** DRAVEN
   * Handles the password reset process when the user clicks the "Forgot Password?" button.
   * It validates the email input and uses Firebase's sendPasswordResetEmail function to send a password reset email to the user.
   * It also manages loading, error, and success states to provide feedback to the user during the process.
   */
  const handleForgotPassword = async () => {
    setForgotError(null);
    setForgotMessage(null);
    const targetEmail = email.trim();
    if (!targetEmail) {
      setForgotError("Please enter your email address to reset password.");
      return;
    }
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setForgotMessage("Password reset email sent! Please check your inbox.");
    } catch (err) {
      console.error("Password reset error:", err);
      if (err.code === "auth/user-not-found") {
        setForgotError("No account found with this email.");
      } else if (err.code === "auth/invalid-email") {
        setForgotError("Invalid email address.");
      } else if (err.code === "auth/too-many-requests") {
        setForgotError("Too many requests. Please try again later.");
      } else {
        setForgotError("Failed to send password reset email. Please try again.");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left side: Info panel */}
      <div className="login-side-panel">
        <h2>Welcome Back to ContentFlow AI</h2>
        <ul className="features-list">
          <li>Manage your content workflow</li>
          <li>Track multiple content stages</li>
          <li>AI-powered content generation</li>
          <li>Real-time collaboration</li>
          <li>Analytics dashboard</li>
        </ul>
        <div className="testimonial">
          <p>"ContentFlow AI helps us stay organized and efficient"</p>
          <small>- Content Manager</small>
        </div>
      </div>

      {/* Right side: Login form card */}
      <div className="login-card">
        <div className="auth-header">
          <h1>Sign In</h1>
          <p className="auth-subtitle">Access your ContentFlow AI account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@contentflow.ai"
              className={error ? "input-error" : ""}
            />
          </div>

          {/* Password with info tooltip + eye icon toggle */}
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

            {/* Password input with eye icon toggle */}
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={error ? "input-error" : ""}
                style={{ paddingRight: '42px', width: '100%', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="eye-icon-btn"
              >
                {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
              </button>
            </div>

            {/* Live requirement indicators shown while typing */}
            {password.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <RequirementRow met={passwordChecks.length} text="At least 8 characters" />
                <RequirementRow met={passwordChecks.uppercase} text="At least 1 uppercase letter" />
                <RequirementRow met={passwordChecks.special} text="At least 1 special character" />
              </div>
            )}
          </div>

          {/* Error messages with option to resend verification email */}
          {error && (
            <div className="error-message">
              {error}
              {showResendVerification && (
                <div style={{ marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="resend-btn"
                  >
                    Resend verification email
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Forgot password */}
          <div className="forgot-row">
            <button
              type="button"
              className="forgot-btn"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
            >
              {forgotLoading ? "Sending..." : "Forgot Password?"}
            </button>
          </div>
          {forgotError && <div className="error-message">{forgotError}</div>}
          {forgotMessage && <div className="success-message">{forgotMessage}</div>}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="oauth-separator">OR</div>

        <div className="oauth-buttons">
          <button
            type="button"
            className="oauth-btn google-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>

        <div className="auth-footer">
          <p>
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="auth-link"
            >
              Sign up here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}