import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../../firebase";
import "../styles/login.css";

/*
 * LOGIN PAGE COMPONENT (Updated by Tanvir)
  - Redesigned with modern two-column layout for better UI consistency with Signup page
  - Info panel positioned on left side, form on right side (opposite of Signup for variety)
  - Features email verification check and password reset functionality remained tghe same
 */
export default function Login({ onLogin }) {
  const navigate = useNavigate();
  console.log("Rendering Login component");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState(null);
  const [forgotMessage, setForgotMessage] = useState(null);

  const googleProvider = new GoogleAuthProvider();

  // TANVIR: Handle Google sign-in with verification and token generation
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setShowResendVerification(false);

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      //Google accounts are always verified, so we can skip the email verification check
      const idToken = await user.getIdToken();
      onLogin({ uid: user.uid, email: user.email, token: idToken });
    } catch (err) {
      setError("Google login failed. Please try again.");
      console.error("Google login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    try {
      await sendEmailVerification(unverifiedUser);
      alert("Verification email sent!");
      setShowResendVerification(false);
    } catch (err) {
      console.error("Error resending verification email:", err);
      setError("Failed to resend verification email. Please try again later.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      //Check if email is verified
      if (!user.emailVerified) {
        setError("Email not verified. Please check your inbox.");
        setShowResendVerification(true);
        setUnverifiedUser(user); //Store user for resending verification email
        // Log out the unverified user immediately
        await auth.signOut();
        setError("Email not verified. Please check your inbox.");
        setLoading(false);
        return;
      }
      //Email is verified, proceed with login
      const idToken = await user.getIdToken();

      onLogin({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "",
        token: idToken,
      });
    } catch (err) {
      let errorMessage = "Login failed. Please try again.";
      // Handle specific Firebase errors
      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (err.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage =
          "Too many failed login attempts. Please try again later.";
      }

      setError(errorMessage);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

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
        setForgotError(
          "Failed to send password reset email. Please try again.",
        );
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    // TANVIR: Modern auth container with reversed layout (info left, form right)
    <div className="login-container">
      {/* Left side: Info panel with features and testimonial */}
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

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ContentFlow123!"
                className={error ? "input-error" : ""}
              />
              {/* TANVIR: Toggle password visibility button */}
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="toggle-password-btn"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* TANVIR: Error messages with option to resend verification email */}
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

          {/* TANVIR: Forgot password link with error/success messages */}
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
          {forgotMessage && (
            <div className="success-message">{forgotMessage}</div>
          )}

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
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
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
