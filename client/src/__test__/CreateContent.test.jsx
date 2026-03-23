/**
 * Unit Tests for CreateContent.jsx
 * Covers: TC-U09, TC-U10
 *
 * Run: cd client && npm test
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateContent from "../components/CreateContent";

// Mock Firebase Auth
const mockCurrentUser = { uid: "user_test_001", email: "test@contentflow.ai" };

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: mockCurrentUser,
  })),
}));

// Mock Firebase Firestore
const mockAddDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  addDoc: (...args) => mockAddDoc(...args),
}));

// Mock Firebase config
vi.mock("../firebase", () => ({
  db: {},
}));

// Mock templateDB functions
vi.mock("../functions/templateDB", () => ({
  fetchTemplates: vi.fn().mockResolvedValue([]),
  incrementTemplateUsage: vi.fn().mockResolvedValue(),
}));

// Mock CSS import
vi.mock("../components/styles/createContent.css", () => ({}));

const renderCreateContent = (props = {}) => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...props,
  };
  return render(<CreateContent {...defaultProps} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAddDoc.mockResolvedValue({ id: "new_content_001" });
});

// TC-U09: Content Creation – Save to Firestore
describe("TC-U09: Content Creation – Save to Firestore", () => {
  test("should call addDoc with correct structure including stage=Draft and createdBy=user.uid", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    renderCreateContent({ onSuccess, onClose });

    // Fill in title and text
    const titleInput = screen.getByPlaceholderText(/enter content title/i);
    const textArea = screen.getByPlaceholderText(/enter your content here/i);

    await userEvent.type(titleInput, "Product Launch");
    await userEvent.type(textArea, "Body content here with product details");

    // Submit form
    const createButton = screen.getByRole("button", { name: /create content/i });
    await userEvent.click(createButton);

    // Assert addDoc was called
    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    // Assert the document structure
    const addDocArgs = mockAddDoc.mock.calls[0];
    const docData = addDocArgs[1]; // second argument is the document data

    expect(docData).toEqual(
      expect.objectContaining({
        title: "Product Launch",
        text: "Body content here with product details",
        stage: "Draft",
        createdBy: "user_test_001",
      })
    );

    // Assert createdAt exists
    expect(docData.createdAt).toBeDefined();

    // Assert templateId exists (defaults to 'new-product-launch' when none selected)
    expect(docData.templateId).toBeDefined();

    // Assert onSuccess and onClose were called
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

// TC-U10: Content Creation – Missing Required Fields
describe("TC-U10: Content Creation – Missing Required Fields", () => {
  test("should show error and not call addDoc when title is empty", async () => {
    renderCreateContent();

    // Only fill text, leave title empty
    const textArea = screen.getByPlaceholderText(/enter your content here/i);
    await userEvent.type(textArea, "Some body text");

    // Submit form
    const createButton = screen.getByRole("button", { name: /create content/i });
    await userEvent.click(createButton);

    // Assert error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();
    });

    // Assert addDoc was NOT called
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  test("should show error and not call addDoc when text is empty", async () => {
    renderCreateContent();

    // Only fill title, leave text empty
    const titleInput = screen.getByPlaceholderText(/enter content title/i);
    await userEvent.type(titleInput, "Valid Title");

    // Submit form
    const createButton = screen.getByRole("button", { name: /create content/i });
    await userEvent.click(createButton);

    // Assert error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();
    });

    // Assert addDoc was NOT called
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  test("should show error when both title and text are empty", async () => {
    renderCreateContent();

    const createButton = screen.getByRole("button", { name: /create content/i });
    await userEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();
    });

    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});