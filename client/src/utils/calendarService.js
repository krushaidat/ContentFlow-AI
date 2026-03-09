import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../firebase";

/**
 * Get calendar data by combining aiSuggestions and calendarSlots collections
 * Returns array of calendar events with status and details
 */
export const getCalendarData = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const events = [];

    // Abdalaa: I load real scheduled items first because those are
    // the ones the user should be able to edit and delete.
    const slotsRef = collection(db, "calendarSlots");
    const slotsQuery = query(slotsRef, where("userId", "==", user.uid));
    const slotsSnapshot = await getDocs(slotsQuery);

    const scheduledPostIds = new Set();

    slotsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.slotStatus === "scheduled" || data.slotStatus === "completed") {
        const normalizedDate =
          typeof data.date === "string"
            ? data.date
            : data.date?.toDate?.().toISOString().split("T")[0] || "";

        events.push({
          id: docSnap.id,
          title: data.title || data.postTitle || "Untitled",
          reason: data.reason || data.description || "",
          suggestedDate: normalizedDate,
          suggestedTime: data.time || "",
          status: data.slotStatus || "scheduled",
          postId: data.postId || "",
          createdAt: data.createdAt || new Date(),
          source: "calendarSlot",
        });

        if (data.postId) {
          scheduledPostIds.add(data.postId);
        }
      }
    });

    // Abdalaa: I only keep AI suggestions for posts that are not already
    // scheduled, otherwise the same post shows twice and opens the wrong modal.
    const suggestionsRef = collection(db, "aiSuggestions");
    const suggestionsQuery = query(
      suggestionsRef,
      where("userId", "==", user.uid)
    );
    const suggestionsSnapshot = await getDocs(suggestionsQuery);

    suggestionsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.postId && scheduledPostIds.has(data.postId)) {
        return;
      }

      events.push({
        id: docSnap.id,
        title: data.title || "Untitled",
        reason: data.reason || "",
        suggestedDate:
          typeof data.suggestedDate === "string"
            ? data.suggestedDate
            : data.suggestedDate?.toDate?.().toISOString().split("T")[0] || "",
        suggestedTime: data.suggestedTime || "",
        status: "idea",
        postId: data.postId || "",
        createdAt: data.createdAt || new Date(),
        source: "aiSuggestion",
      });
    });

    events.sort((a, b) => new Date(a.suggestedDate) - new Date(b.suggestedDate));

    console.log(" final calendar events:", events);
    return events;
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    throw error;
  }
};

/**
 * Get ai suggestions for a specific date range
 */
export const getAISuggestionsForDateRange = async (startDate, endDate) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const suggestionsRef = collection(db, "aiSuggestions");
    const suggestionsQuery = query(
      suggestionsRef,
      where("userId", "==", user.uid),
      where("suggestedDate", ">=", startDate),
      where("suggestedDate", "<=", endDate)
    );

    const snapshot = await getDocs(suggestionsQuery);
    const suggestions = [];

    snapshot.forEach((doc) => {
      suggestions.push({
        id: doc.id,
        ...doc.data(),
        status: "idea",
      });
    });

    return suggestions;
  } catch (error) {
    console.error("Error fetching AI suggestions:", error);
    throw error;
  }
};

/**
 * Get calendar slots for a specific date range
 */
export const getCalendarSlotsForDateRange = async (startDate, endDate) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const slotsRef = collection(db, "calendarSlots");
    const slotsQuery = query(
      slotsRef,
      where("userId", "==", user.uid),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );

    const snapshot = await getDocs(slotsQuery);
    const slots = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      slots.push({
        id: doc.id,
        title: data.title || data.postTitle || "Untitled",
        date: data.date,
        time: data.time,
        status: data.slotStatus || "scheduled",
        ...data,
      });
    });

    return slots;
  } catch (error) {
    console.error("Error fetching calendar slots:", error);
    throw error;
  }
};

/**
 * Get a single AI suggestion by ID
 */
export const getAISuggestion = async (suggestionId) => {
  try {
    const docRef = doc(db, "aiSuggestions", suggestionId);
    const docSnapshot = await getDoc(docRef);

    if (docSnapshot.exists()) {
      return {
        id: docSnapshot.id,
        ...docSnapshot.data(),
        status: "idea",
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching AI suggestion:", error);
    throw error;
  }
};

/**
 * Get a single calendar slot by ID
 */
export const getCalendarSlot = async (slotId) => {
  try {
    const docRef = doc(db, "calendarSlots", slotId);
    const docSnapshot = await getDoc(docRef);

    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      return {
        id: docSnapshot.id,
        title: data.title || data.postTitle || "Untitled",
        ...data,
        status: data.slotStatus || "scheduled",
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching calendar slot:", error);
    throw error;
  }
};

/**
 * Get all suggestions pending validation
 */
export const getPendingSuggestions = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const suggestionsRef = collection(db, "aiSuggestions");
    const suggestionsQuery = query(
      suggestionsRef,
      where("userId", "==", user.uid),
      where("status", "==", "pending")
    );

    const snapshot = await getDocs(suggestionsQuery);
    const suggestions = [];

    snapshot.forEach((doc) => {
      suggestions.push({
        id: doc.id,
        ...doc.data(),
        status: "idea",
      });
    });

    return suggestions;
  } catch (error) {
    console.error("Error fetching pending suggestions:", error);
    throw error;
  }
};
