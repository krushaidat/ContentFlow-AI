/**
 * Unit Tests for geminiReviewerAssignment.js
 * Covers: TC-U16, TC-U17
 *
 * Run: cd client && npm test
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { assignReviewerWithGemini, getAvailableReviewers } from "../utils/geminiReviewerAssignment";

// Mock environment variable
vi.stubEnv("VITE_GEMINI_API_KEY", "test-gemini-api-key");

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Firebase Firestore imports
vi.mock("firebase/firestore", () => ({
  where: vi.fn((...args) => args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// TC-U16: AI Reviewer Assignment – Successful Assignment via Gemini
describe("TC-U16: AI Reviewer Assignment – Successful Assignment via Gemini", () => {
  test("should call Gemini API and return the selected reviewer UID", async () => {
    const contentItem = {
      title: "Product Launch Announcement",
      type: "Marketing",
      category: "Product",
    };

    const availableReviewers = [
      {
        uid: "reviewer_001",
        name: "Jane Doe",
        expertise: "Marketing",
        currentLoad: 2,
        isAvailable: true,
      },
      {
        uid: "reviewer_002",
        name: "Bob Smith",
        expertise: "General",
        currentLoad: 4,
        isAvailable: true,
      },
    ];

    // Mock Gemini API response: selects reviewer_001
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ text: "REVIEWER_UID:reviewer_001" }],
              },
            },
          ],
        }),
    });

    const result = await assignReviewerWithGemini(contentItem, availableReviewers);

    // Assert Gemini API was called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("gemini-2.0-flash:generateContent"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    // Assert correct reviewer was returned
    expect(result).toBe("reviewer_001");
  });

  test("should fall back to random reviewer when Gemini returns unparseable response", async () => {
    const contentItem = { title: "Test Content", type: "General" };
    const availableReviewers = [
      { uid: "reviewer_001", name: "Jane", currentLoad: 1, isAvailable: true },
    ];

    // Mock Gemini API response with no parseable REVIEWER_UID
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ text: "I recommend assigning to Jane." }], // no REVIEWER_UID format
              },
            },
          ],
        }),
    });

    const result = await assignReviewerWithGemini(contentItem, availableReviewers);

    // Should fall back to pickRandomReviewer and return the only available reviewer
    expect(result).toBe("reviewer_001");
  });

  test("should fall back to random reviewer when Gemini returns 429 rate limit", async () => {
    const contentItem = { title: "Test Content", type: "General" };
    const availableReviewers = [
      { uid: "reviewer_001", name: "Jane", currentLoad: 0, isAvailable: true },
      { uid: "reviewer_002", name: "Bob", currentLoad: 3, isAvailable: true },
    ];

    // Mock Gemini API returning 429
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    });

    const result = await assignReviewerWithGemini(contentItem, availableReviewers);

    // Should fall back and pick one (preferring lowest load = reviewer_001)
    expect(result).toBe("reviewer_001");
  });

  test("should fall back to random reviewer when fetch throws network error", async () => {
    const contentItem = { title: "Test Content" };
    const availableReviewers = [
      { uid: "reviewer_003", name: "Alice", currentLoad: 1, isAvailable: true },
    ];

    // Mock fetch to throw error
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await assignReviewerWithGemini(contentItem, availableReviewers);

    // Should still return a reviewer via fallback
    expect(result).toBe("reviewer_003");
  });
});

// TC-U17: AI Reviewer Assignment – No Reviewers Available
describe("TC-U17: AI Reviewer Assignment – No Reviewers Available", () => {
  test("should return null when no reviewers are available", async () => {
    const contentItem = { title: "Test Content", type: "General" };
    const availableReviewers = []; // empty

    const result = await assignReviewerWithGemini(contentItem, availableReviewers);

    // Should return null since no reviewers exist
    expect(result).toBeNull();
  });

  test("getAvailableReviewers should return empty array when no reviewer-role users exist", async () => {
    const mockDb = {};
    const mockCollection = vi.fn();
    const mockQuery = vi.fn();
    const mockGetDocs = vi.fn().mockResolvedValue({
      docs: [], // no reviewer documents
    });

    const result = await getAvailableReviewers(mockDb, mockCollection, mockQuery, mockGetDocs);

    expect(result).toEqual([]);
  });

  test("getAvailableReviewers should return reviewer list when reviewers exist", async () => {
    const mockDb = {};
    const mockCollection = vi.fn();
    const mockQuery = vi.fn();
    const mockGetDocs = vi.fn().mockResolvedValue({
      docs: [
        {
          id: "reviewer_001",
          data: () => ({
            name: "Jane Doe",
            role: "reviewer",
            currentLoad: 2,
          }),
        },
        {
          id: "reviewer_002",
          data: () => ({
            name: "Bob Smith",
            role: "reviewer",
            currentLoad: 0,
          }),
        },
      ],
    });

    const result = await getAvailableReviewers(mockDb, mockCollection, mockQuery, mockGetDocs);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        uid: "reviewer_001",
        name: "Jane Doe",
      })
    );
  });
});