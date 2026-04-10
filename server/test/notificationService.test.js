const mockGet = jest.fn();
const mockAdd = jest.fn();
const mockLimit = jest.fn(() => ({ get: mockGet }));
const mockWhere = jest.fn(() => ({ limit: mockLimit }));
const mockNotificationsRef = {
  where: mockWhere,
  add: mockAdd,
};
const mockDoc = jest.fn(() => ({
  collection: jest.fn(() => mockNotificationsRef),
}));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));

jest.mock("../config/firebase", () => ({
  db: {
    collection: mockCollection,
  },
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
      },
    },
  },
}));

const { createNotification } = require("../utils/notificationService");

describe("notificationService.createNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates a new notification when dedupe is disabled even if eventKey already exists", async () => {
    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ id: "existing_notification" }],
    });
    mockAdd.mockResolvedValue({ id: "new_notification" });

    const notificationId = await createNotification({
      recipientId: "user_123",
      type: "content_rejected",
      title: "Changes Requested",
      message: 'Reviewer requested updates for "Launch Post".',
      contentId: "content_123",
      actorId: "reviewer_123",
      eventKey: "content_rejected_content_123_reviewer_123",
      dedupe: false,
    });

    expect(mockWhere).not.toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(notificationId).toBe("new_notification");
  });
});
