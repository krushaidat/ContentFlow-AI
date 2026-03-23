/**
 * Unit Tests for Signup.jsx
 * Covers: TC-U01, TC-U02, TC-U03
 *
 * Run: cd client && npm test
 * Requires: npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom
 * 
 * Add to client/vite.config.js:
 *   test: { globals: true, environment: 'jsdom', setupFiles: './src/setupTests.js' }
 * 
 * Create client/src/setupTests.js:
 *   import '@testing-library/jest-dom';
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Signup from "../components/pages/Signup";

// Mock Firebase Auth
const mockCreateUser = vi.fn();
const mockSendEmailVerification = vi.fn();
const mockUpdateProfile = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithPopup = vi.fn();

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  createUserWithEmailAndPassword: (...args) => mockCreateUser(...args),
  sendEmailVerification: (...args) => mockSendEmailVerification(...args),
  updateProfile: (...args) => mockUpdateProfile(...args),
  signOut: (...args) => mockSignOut(...args),
  signInWithPopup: (...args) => mockSignInWithPopup(...args),
  GoogleAuthProvider: vi.fn(),
}));

// Mock Firebase Firestore
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  setDoc: (...args) => mockSetDoc(...args),
  doc: vi.fn(() => ({})),
  getDoc: (...args) => mockGetDoc(...args),
}));

// Mock Firebase config
vi.mock("../../firebase", () => ({
  auth: { onAuthStateChanged: vi.fn(), currentUser: null },
  db: {},
}));

// Mock react-icons
vi.mock("react-icons/ai", () => ({
  AiOutlineEye: () => <span>eye</span>,
  AiOutlineEyeInvisible: () => <span>eye-off</span>,
}));

const renderSignup = (onSignup = vi.fn()) => {
  return render(
    <MemoryRouter>
      <Signup onSignup={onSignup} />
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

// TC-U01: User Registration – Valid Input
describe("TC-U01: User Registration – Valid Input", () => {
  test("should call createUserWithEmailAndPassword, setDoc, and sendEmailVerification with valid inputs", async () => {
    const mockUser = {
      uid: "test_uid_001",
      email: "test@contentflow.ai",
      displayName: "John Doe",
      getIdToken: vi.fn().mockResolvedValue("mock-token"),
      emailVerified: false,
    };

    mockCreateUser.mockResolvedValue({ user: mockUser });
    mockUpdateProfile.mockResolvedValue();
    mockSetDoc.mockResolvedValue();
    mockSendEmailVerification.mockResolvedValue();

    renderSignup();

    // Fill in all form fields
    await userEvent.type(screen.getByLabelText(/first name/i), "John");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email address/i), "test@contentflow.ai");
    await userEvent.type(screen.getByPlaceholderText(/create a password/i), "Test@1234");
    await userEvent.type(screen.getByPlaceholderText(/confirm your password/i), "Test@1234");

    // Submit form
    const submitButton = screen.getByRole("button", { name: /create account/i });
    await userEvent.click(submitButton);

    // Assert Firebase createUserWithEmailAndPassword was called
    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledTimes(1);
    });

    // Assert sendEmailVerification was called
    await waitFor(() => {
      expect(mockSendEmailVerification).toHaveBeenCalledTimes(1);
    });

    // Assert Firestore setDoc was called to create user document
    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const setDocArgs = mockSetDoc.mock.calls[0];
      // Second argument should contain user data with role='user'
      expect(setDocArgs[1]).toEqual(
        expect.objectContaining({
          email: "test@contentflow.ai",
          firstName: "John",
          lastName: "Doe",
          role: "user",
        })
      );
    });
  });
});

// TC-U02: User Registration – Duplicate Email
describe("TC-U02: User Registration – Duplicate Email", () => {
  test("should display 'This email is already registered.' error", async () => {
    const authError = new Error("Email already in use");
    authError.code = "auth/email-already-in-use";
    mockCreateUser.mockRejectedValue(authError);

    renderSignup();

    // Fill form with valid data
    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email address/i), "existing@contentflow.ai");
    await userEvent.type(screen.getByPlaceholderText(/create a password/i), "Test@1234");
    await userEvent.type(screen.getByPlaceholderText(/confirm your password/i), "Test@1234");

    const submitButton = screen.getByRole("button", { name: /create account/i });
    await userEvent.click(submitButton);

    // Assert error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/this email is already registered/i)).toBeInTheDocument();
    });

    // Assert Firestore setDoc was NOT called (no document created for duplicate)
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

// TC-U03: User Registration – Weak Password Rejected
describe("TC-U03: User Registration – Weak Password Rejected", () => {
  test("should reject password with no uppercase and no special character", async () => {
    renderSignup();

    await userEvent.type(screen.getByLabelText(/first name/i), "Test");
    await userEvent.type(screen.getByLabelText(/last name/i), "User");
    await userEvent.type(screen.getByLabelText(/email address/i), "test@test.com");
    await userEvent.type(screen.getByPlaceholderText(/create a password/i), "password");
    await userEvent.type(screen.getByPlaceholderText(/confirm your password/i), "password");

    const submitButton = screen.getByRole("button", { name: /create account/i });
    
    // Button should be disabled because password requirements are not met
    expect(submitButton).toBeDisabled();

    // Firebase should NOT be called
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test("should reject password without special character", async () => {
    renderSignup();

    await userEvent.type(screen.getByLabelText(/first name/i), "Test");
    await userEvent.type(screen.getByLabelText(/last name/i), "User");
    await userEvent.type(screen.getByLabelText(/email address/i), "test@test.com");
    await userEvent.type(screen.getByPlaceholderText(/create a password/i), "Pass1234");
    await userEvent.type(screen.getByPlaceholderText(/confirm your password/i), "Pass1234");

    const submitButton = screen.getByRole("button", { name: /create account/i });
    expect(submitButton).toBeDisabled();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test("should reject password under 8 characters", async () => {
    renderSignup();

    await userEvent.type(screen.getByLabelText(/first name/i), "Test");
    await userEvent.type(screen.getByLabelText(/last name/i), "User");
    await userEvent.type(screen.getByLabelText(/email address/i), "test@test.com");
    await userEvent.type(screen.getByPlaceholderText(/create a password/i), "Te@1");
    await userEvent.type(screen.getByPlaceholderText(/confirm your password/i), "Te@1");

    const submitButton = screen.getByRole("button", { name: /create account/i });
    expect(submitButton).toBeDisabled();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});