/**
 * Unit Tests for Login.jsx
 * Covers: TC-U04, TC-U05, TC-U06
 *
 * Run: cd client && npm test
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../components/pages/Login";

// Mock Firebase Auth
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSendEmailVerification = vi.fn();
const mockSendPasswordResetEmail = vi.fn();

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
    signOut: mockSignOut,
    onAuthStateChanged: vi.fn(),
  })),
  signInWithEmailAndPassword: (...args) => mockSignIn(...args),
  signInWithPopup: (...args) => mockSignInWithPopup(...args),
  sendEmailVerification: (...args) => mockSendEmailVerification(...args),
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
  GoogleAuthProvider: vi.fn(),
}));

// Mock Firebase Firestore
vi.mock("firebase/firestore", () => ({
  setDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({}) }),
}));

// Mock Firebase config
vi.mock("../../firebase", () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
    currentUser: null,
    signOut: vi.fn(),
  },
  db: {},
}));

// Mock react-icons
vi.mock("react-icons/ai", () => ({
  AiOutlineEye: () => <span>eye</span>,
  AiOutlineEyeInvisible: () => <span>eye-off</span>,
}));

// Mock useInPageAlert
vi.mock("../../hooks/useInPageAlert", () => ({
  default: () => ({
    alertState: { visible: false, message: "", type: "" },
    showAlert: vi.fn(),
    dismissAlert: vi.fn(),
  }),
}));

// Mock InPageAlert component
vi.mock("../InPageAlert", () => ({
  default: () => null,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderLogin = (onLogin = vi.fn()) => {
  return render(
    <MemoryRouter>
      <Login onLogin={onLogin} />
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// TC-U04: User Authentication – Valid Login
describe("TC-U04: User Authentication – Valid Login", () => {
  test("should call signInWithEmailAndPassword and trigger onLogin callback on valid credentials", async () => {
    const mockUser = {
      uid: "test_uid_001",
      email: "test@contentflow.ai",
      displayName: "Test User",
      emailVerified: true,
      getIdToken: vi.fn().mockResolvedValue("mock-id-token"),
    };

    mockSignIn.mockResolvedValue({ user: mockUser });
    const onLogin = vi.fn();

    renderLogin(onLogin);

    await userEvent.type(screen.getByLabelText(/email address/i), "test@contentflow.ai");
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), "Test@1234");

    const submitButton = screen.getByRole("button", { name: /sign in/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });

    // onLogin callback should be invoked with user session
    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "test_uid_001",
          email: "test@contentflow.ai",
        })
      );
    });
  });
});

// TC-U05: User Authentication – Invalid Credentials
describe("TC-U05: User Authentication – Invalid Credentials", () => {
  test("should display error message on wrong password", async () => {
    const authError = new Error("Wrong password");
    authError.code = "auth/wrong-password";
    mockSignIn.mockRejectedValue(authError);

    renderLogin();

    await userEvent.type(screen.getByLabelText(/email address/i), "test@contentflow.ai");
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), "WrongPass@1");

    const submitButton = screen.getByRole("button", { name: /sign in/i });
    await userEvent.click(submitButton);

    // Assert error message appears
    await waitFor(() => {
      const errorEl = screen.getByText(/invalid email or password/i);
      expect(errorEl).toBeInTheDocument();
    });

    // Assert no navigation to dashboard
    expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
  });

  test("should not create session on failed login", async () => {
    const authError = new Error("Wrong password");
    authError.code = "auth/wrong-password";
    mockSignIn.mockRejectedValue(authError);

    const onLogin = vi.fn();
    renderLogin(onLogin);

    await userEvent.type(screen.getByLabelText(/email address/i), "test@contentflow.ai");
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), "WrongPass@1");

    const submitButton = screen.getByRole("button", { name: /sign in/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onLogin).not.toHaveBeenCalled();
    });
  });
});

// TC-U06: User Authentication – Unverified Email Blocked
describe("TC-U06: User Authentication – Unverified Email Blocked", () => {
  test("should block login for unverified email and show resend verification option", async () => {
    const mockUser = {
      uid: "test_uid_unverified",
      email: "unverified@contentflow.ai",
      displayName: "Unverified User",
      emailVerified: false, // NOT VERIFIED
      getIdToken: vi.fn(),
    };

    mockSignIn.mockResolvedValue({ user: mockUser });
    const onLogin = vi.fn();

    renderLogin(onLogin);

    await userEvent.type(screen.getByLabelText(/email address/i), "unverified@contentflow.ai");
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), "Test@1234");

    const submitButton = screen.getByRole("button", { name: /sign in/i });
    await userEvent.click(submitButton);

    // Assert error message about email verification
    await waitFor(() => {
      expect(screen.getByText(/email not verified/i)).toBeInTheDocument();
    });

    // Assert resend verification button is shown
    await waitFor(() => {
      expect(screen.getByText(/resend verification email/i)).toBeInTheDocument();
    });

    // Assert onLogin was NOT called (user not logged in)
    expect(onLogin).not.toHaveBeenCalled();

    // Assert sign out was called to prevent unverified session
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});