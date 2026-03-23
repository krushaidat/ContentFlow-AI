/**
 * Unit Tests for teamController.js
 * Covers: TC-U08, TC-U19
 *
 * Run: cd server && npm test
 * Requires: npm install --save-dev jest
 */

// --- Mock Firebase Admin SDK ---
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet, update: mockUpdate }));
const mockWhere = jest.fn().mockReturnThis();
const mockGetQuery = jest.fn();
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: mockWhere,
  get: mockGetQuery,
}));

jest.mock("../config/firebase", () => ({
  collection: mockCollection,
  doc: mockDoc,
}));

const mockDb = { collection: mockCollection };
jest.mock("../config/firebase", () => mockDb);

jest.mock("firebase-admin", () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  firestore: jest.fn(() => mockDb),
}));

const { addMemberToTeam, changeMemberRole } = require("../controllers/teamController");

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

// TC-U08: Admin Permission Enforcement
describe("TC-U08: Role-Based Access Control – Admin Permission Enforcement", () => {
  test("addMemberToTeam should return 403 for non-admin user", async () => {
    const req = mockReq({
      adminId: "user_non_admin",
      memberEmail: "member@test.com",
      teamId: "team_1",
    });
    const res = mockRes();

    // Mock: requesting user has role='user' (not admin)
    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            role: "user",
            teamId: "team_1",
          }),
        }),
        update: jest.fn(),
      })),
      where: jest.fn().mockReturnThis(),
      get: jest.fn(),
    }));

    await addMemberToTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Only admins can add team members",
      })
    );
  });

  test("changeMemberRole should return 403 for non-admin user", async () => {
    const req = mockReq({
      adminId: "user_non_admin",
      memberId: "member_001",
      newRole: "reviewer",
      teamId: "team_1",
    });
    const res = mockRes();

    // Mock: requesting user has role='user' (not admin)
    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            role: "user",
            teamId: "team_1",
          }),
        }),
        update: jest.fn(),
      })),
    }));

    await changeMemberRole(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Only admins can change member roles",
      })
    );
  });

  test("addMemberToTeam should succeed for admin user", async () => {
    const req = mockReq({
      adminId: "admin_001",
      memberEmail: "newmember@test.com",
      teamId: "team_1",
    });
    const res = mockRes();

    const mockMemberUpdate = jest.fn().mockResolvedValue({});

    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => {
        // Admin user check
        if (docId === "admin_001") {
          return {
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ role: "admin", teamId: "team_1" }),
            }),
          };
        }
        // Member to be added
        return {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ role: "user", email: "newmember@test.com" }),
          }),
          update: mockMemberUpdate,
        };
      }),
      where: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [
            {
              id: "member_001",
              data: () => ({ email: "newmember@test.com" }),
            },
          ],
        }),
      })),
    }));

    await addMemberToTeam(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Member added to team successfully",
      })
    );
  });

  test("addMemberToTeam should return 400 when required fields are missing", async () => {
    const req = mockReq({ adminId: "admin_001" }); // missing memberEmail and teamId
    const res = mockRes();

    await addMemberToTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "adminId, memberEmail, and teamId are required",
      })
    );
  });

  test("changeMemberRole should return 400 for invalid role", async () => {
    const req = mockReq({
      adminId: "admin_001",
      memberId: "member_001",
      newRole: "superadmin", // invalid role
      teamId: "team_1",
    });
    const res = mockRes();

    // Mock admin check to pass
    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ role: "admin", teamId: "team_1" }),
        }),
        update: jest.fn(),
      })),
    }));

    await changeMemberRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Invalid role"),
      })
    );
  });
});

// TC-U19: Team Data Isolation – Cross-Team Access Blocked
describe("TC-U19: Team Data Isolation – Cross-Team Access Blocked", () => {
  test("should return 403 when admin teamId does not match request teamId", async () => {
    const req = mockReq({
      adminId: "admin_001",
      memberEmail: "member@test.com",
      teamId: "team_2", // admin belongs to team_1, requesting team_2
    });
    const res = mockRes();

    // Mock: admin belongs to team_1
    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            role: "admin",
            teamId: "team_1", // admin's actual team
          }),
        }),
        update: jest.fn(),
      })),
      where: jest.fn().mockReturnThis(),
      get: jest.fn(),
    }));

    await addMemberToTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Admin does not have access to this team",
      })
    );
  });

  test("changeMemberRole should return 403 for cross-team role change", async () => {
    const req = mockReq({
      adminId: "admin_001",
      memberId: "member_001",
      newRole: "reviewer",
      teamId: "team_2", // admin belongs to team_1
    });
    const res = mockRes();

    mockDb.collection = jest.fn((collectionName) => ({
      doc: jest.fn((docId) => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            role: "admin",
            teamId: "team_1",
          }),
        }),
        update: jest.fn(),
      })),
    }));

    await changeMemberRole(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Admin does not have access to this team",
      })
    );
  });
});