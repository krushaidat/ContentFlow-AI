import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "../hooks/useAuth";

const mockOnAuthStateChanged = vi.fn();
const mockDoc = vi.fn();
const mockOnSnapshot = vi.fn();

vi.mock("../firebase", () => ({
  auth: {
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),   
},
db: {__name: "mock-db"},
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

describe("TC-U07: Role-Based Access Control – User Role Retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  test("queries Users/{uid} and returns role=reviewer from hook", async () => {
    const fakeUid = "uid_reviewer_001";
    const fakeFirebaseUser = { uid: fakeUid, email: "reviewer@example.com" };
    const fakeUserDocRef = { path: `Users/${fakeUid}` };

    mockDoc.mockReturnValue(fakeUserDocRef);

    mockOnAuthStateChanged.mockImplementation((cb) => {
      cb(fakeFirebaseUser);
      return vi.fn();
    });

    mockOnSnapshot.mockImplementation((userDocRef, onNext) => {
        onNext({
          exists: () => true,
          data: () => ({ role: "reviewer", firstName: "Rev" }),
        });
        return vi.fn();
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
        expect(mockDoc).toHaveBeenCalledTimes(1);
    });

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "Users", fakeUid);
    expect(mockOnSnapshot).toHaveBeenCalledWith(
      fakeUserDocRef,
      expect.any(Function),
      expect.any(Function)
    );

    await waitFor(() => {
      expect(result.current.user).toEqual(
        expect.objectContaining({
          uid: fakeUid,
          email: "reviewer@example.com",
          role: "reviewer",
        })
      );
    });
  });
});