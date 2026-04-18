/**
 * Unit Tests for aiController.js
 * Covers: TC-U13, TC-U14, TC-U15, TC-U18
 * 
 * Run: cd server && npm test
 * Requires: npm install --save-dev jest
 * Add to server/package.json scripts: "test": "jest --verbose"
 */

// Mock Firebase Admin SDK
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockAdd = jest.fn();
const mockArrayUnion = jest.fn((value) => ({ __arrayUnion: value }));
const mockDoc = jest.fn(() => ({ get: mockGet, update: mockUpdate }));
const mockWhere = jest.fn().mockReturnThis();
const mockCollection = jest.fn(() => ({ doc: mockDoc, where: mockWhere, get: mockGet, add: mockAdd }));

const mockDb = { collection: mockCollection };
jest.mock("../config/firebase", () => ({
  db: mockDb,
  admin: {
    firestore: {
      FieldValue: {
        arrayUnion: mockArrayUnion,
        delete: jest.fn(),
      },
    },
  },
}));

// Mock Gemini API
const mockGenerateContent = jest.fn();
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: mockGenerateContent,
    })),
  })),
}));

// Set env before requiring controller
process.env.GEMINI_API_KEY = "test-api-key";

const { validatePost, applyFixes, suggestPostTime } = require("../controllers/aiController");

// Helper to create mock req/res
const mockReq = (body) => ({ body });
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AI apply fixes version history", () => {
  test("stores the previous content in versionHistory before saving AI fixes", async () => {
    const req = mockReq({ postId: "post_fix_001" });
    const res = mockRes();

    const mockUpdateFn = jest.fn().mockResolvedValue({});

    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            title: "Old title",
            text: "Old content body",
            stage: "Draft",
            createdBy: "user_123",
            templateId: "new-product-launch",
            validation: {
              suggestions: ["Tighten CTA"],
            },
          }),
        }),
        update: mockUpdateFn,
      })),
    }));

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            fixedTitle: "Improved title",
            fixedText: "Improved content body",
            changesSummary: ["Updated CTA"],
          }),
      },
    });

    await applyFixes(req, res);

    expect(mockArrayUnion).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Old title",
        text: "Old content body",
        stage: "Draft",
        snapshotBy: "user_123",
        changeType: "ai_fix",
        reason: "AI fixes applied in workflow",
      })
    );

    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Improved title",
        text: "Improved content body",
        fixChangesSummary: ["Updated CTA"],
        versionHistory: expect.objectContaining({
          __arrayUnion: expect.objectContaining({
            title: "Old title",
            text: "Old content body",
            changeType: "ai_fix",
          }),
        }),
      })
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        fixedTitle: "Improved title",
        fixedText: "Improved content body",
        changesSummary: ["Updated CTA"],
      })
    );
  });
});

// =============================================
// TC-U13: AI Validation – Successful Gemini API Response
// =============================================
describe("TC-U13: AI Validation – Successful Gemini API Response", () => {
  test("should call Gemini, parse response, update Firestore, and return 200", async () => {
    const req = mockReq({ postId: "post_001" });
    const res = mockRes();

    // Mock Firestore: content document exists with text and templateId
    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            text: "This is a product launch announcement with key features.",
            templateId: "new-product-launch",
          }),
        }),
        update: mockUpdate.mockResolvedValue({}),
      })),
    }));

    // Mock Gemini API to return valid JSON
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            compliance: true,
            brandScore: 85,
            missingSections: [],
            suggestions: ["Add a call-to-action"],
          }),
      },
    });

    await validatePost(req, res);

    // Assert Gemini was called
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // Assert response is 200 with success: true
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        validation: expect.objectContaining({
          compliance: true,
          brandScore: 85,
          suggestions: expect.arrayContaining(["Add a call-to-action"]),
        }),
      })
    );
  });
});

// =============================================
// TC-U14: AI Validation – Gemini API Failure / Quota Exceeded
// =============================================
describe("TC-U14: AI Validation – Gemini API Failure / Quota Exceeded", () => {
  test("should return fallback data when Gemini returns 429 quota error", async () => {
    const req = mockReq({ postId: "post_001" });
    const res = mockRes();

    // Mock Firestore: content document exists
    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            text: "Some content text",
            templateId: "new-product-launch",
          }),
        }),
        update: mockUpdate.mockResolvedValue({}),
      })),
    }));

    // Mock Gemini API to throw 429 quota error
    const quotaError = new Error("Quota exceeded");
    quotaError.status = 429;
    quotaError.message = "Quota exceeded";
    mockGenerateContent.mockRejectedValue(quotaError);

    await validatePost(req, res);

    // Should return success with fallback brandScore: 82
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        validation: expect.objectContaining({
          brandScore: 82,
          compliance: true,
        }),
      })
    );
  });

  test("should return 500 when Gemini throws non-quota error", async () => {
    const req = mockReq({ postId: "post_001" });
    const res = mockRes();

    // Mock Firestore: content document exists
    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            text: "Some content text",
            templateId: "new-product-launch",
          }),
        }),
        update: mockUpdate.mockResolvedValue({}),
      })),
    }));

    // Mock Gemini API to throw 500 server error
    const serverError = new Error("Internal Server Error");
    serverError.status = 500;
    mockGenerateContent.mockRejectedValue(serverError);

    await validatePost(req, res);

    // Should return 500 error
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("should return 400 when postId is missing", async () => {
    const req = mockReq({});
    const res = mockRes();

    await validatePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "postId is required" })
    );
  });

  test("should return 404 when content document does not exist", async () => {
    const req = mockReq({ postId: "nonexistent_id" });
    const res = mockRes();

    mockDb.collection = jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false }),
      })),
    }));

    await validatePost(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Content not found" })
    );
  });
});

// =============================================
// TC-U15: Brand Consistency Score – Score Stored Correctly
// =============================================
describe("TC-U15: Brand Consistency Score – Score Stored Correctly", () => {
  test("should store brandScore=42 and compliance=false in Firestore", async () => {
    const req = mockReq({ postId: "post_002" });
    const res = mockRes();

    const mockUpdateFn = jest.fn().mockResolvedValue({});

    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            text: "Incomplete content missing brand voice",
            templateId: "company-announcement",
          }),
        }),
        update: mockUpdateFn,
      })),
    }));

    // Mock Gemini to return low score
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            compliance: false,
            brandScore: 42,
            missingSections: ["intro"],
            suggestions: ["Revise tone to match brand voice"],
          }),
      },
    });

    await validatePost(req, res);

    // Assert Firestore update was called with correct brand score
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        validation: expect.objectContaining({
          brandScore: 42,
          compliance: false,
          suggestions: expect.arrayContaining(["Revise tone to match brand voice"]),
          missingSections: expect.arrayContaining(["intro"]),
        }),
      })
    );
  });
});

// =============================================
// TC-U18: AI Scheduling – Suggest Post Time
// =============================================
describe("TC-U18: AI Scheduling – Suggest Post Time", () => {
  test("should return scheduling suggestion and store in Firestore collections", async () => {
    const req = mockReq({ postId: "post_005", userId: "user_001" });
    const res = mockRes();

    const mockAddFn = jest.fn().mockResolvedValue({ id: "new_doc_id" });

    mockDb.collection = jest.fn((collectionName) => {
      if (collectionName === "content") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                title: "Product Launch",
                text: "Launch details here",
              }),
            }),
          })),
        };
      }
      if (collectionName === "calendarSlots") {
        return {
          where: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              docs: [
                {
                  data: () => ({
                    date: "2026-04-10",
                    time: "09:00",
                    slotStatus: "scheduled",
                  }),
                },
              ],
            }),
          })),
          add: mockAddFn,
        };
      }
      if (collectionName === "aiSuggestions") {
        return { add: mockAddFn };
      }
      return { doc: jest.fn(), add: mockAddFn };
    });

    // Mock Gemini to return scheduling suggestion
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            suggestedDate: "2026-04-15",
            suggestedTime: "10:00",
            reason: "Optimal engagement window",
          }),
      },
    });

    await suggestPostTime(req, res);

    // Assert response contains scheduling data
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        suggestedDate: "2026-04-15",
        suggestedTime: "10:00",
        reason: "Optimal engagement window",
        source: "gemini",
      })
    );

    // Assert calendarSlots and aiSuggestions were written
    expect(mockAddFn).toHaveBeenCalledTimes(2);
  });

  test("should return 400 when postId or userId is missing", async () => {
    const req = mockReq({ postId: "post_005" }); // missing userId
    const res = mockRes();

    await suggestPostTime(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "postId and userId are required",
      })
    );
  });
});