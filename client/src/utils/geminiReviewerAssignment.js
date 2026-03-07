import { where } from 'firebase/firestore';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.0-flash'; // updated model

/**DRAVEN
 * Picks a fallback reviewer when AI assignment is unavailable.
 * Strategy:
 * 1) Prefer reviewers marked available
 * 2) Prefer lowest currentLoad
 * 3) Randomly pick among ties
 * @param {Array<Object>} reviewers
 * @returns {string|null} reviewer uid or null if none
 */
const pickRandomReviewer = (reviewers = []) => {
  if (!reviewers.length) return null;

  const available = reviewers.filter(r => r?.isAvailable !== false);
  const pool = available.length ? available : reviewers;

  // prefer lower load, then random among best
  const minLoad = Math.min(...pool.map(r => Number(r?.currentLoad ?? 0)));
  const leastLoaded = pool.filter(r => Number(r?.currentLoad ?? 0) === minLoad);

  const chosen = leastLoaded[Math.floor(Math.random() * leastLoaded.length)];
  return chosen?.uid ?? null;
};

/**DRAVEN
 * Uses Gemini to select the best reviewer for a content item.
 * Falls back to pickRandomReviewer on rate limits/errors/parse failures.
 * @param {Object} contentItem - Content being assigned.
 * @param {Array<Object>} availableReviewers - Candidate reviewer list.
 * @returns {Promise<string|null>} reviewer uid or null.
 */
export const assignReviewerWithGemini = async (contentItem, availableReviewers) => {
  try {
    if (!GEMINI_API_KEY) throw new Error('Missing VITE_GEMINI_API_KEY');

    const prompt = `
      You are a content review assignment system. Based on the following information, assign the most suitable reviewer.

      Content to Review:
      - Title: ${contentItem.title}
      - Type: ${contentItem.type || 'General'}
      - Category: ${contentItem.category || 'General'}

      Available Reviewers:
      ${availableReviewers.map(r => `- ${r.name} (ID: ${r.uid}, Expertise: ${r.expertise || 'General'}, Current Load: ${r.currentLoad}/5, Available: ${r.isAvailable ? 'Yes' : 'No'})`).join('\n')}

      Respond with ONLY: REVIEWER_UID:uid_value
    `;

    const response = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    // Fallback when rate limited
    if (response.status === 429) {
      console.warn('Gemini rate limited (429). Falling back to random reviewer assignment.');
      return pickRandomReviewer(availableReviewers);
    }

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const uidMatch = responseText.match(/REVIEWER_UID:([a-zA-Z0-9_-]+)/);

    // Fallback if parse fails
    return uidMatch ? uidMatch[1] : pickRandomReviewer(availableReviewers);
  } catch (error) {
    console.error('Error with Gemini API assignment:', error);
    // Fallback on any runtime error
    return pickRandomReviewer(availableReviewers);
  }
};

/**DRAVEN
 * Reads reviewer users from Firestore.
 * Filters users by role = "reviewer".
 * @param {any} db
 * @param {Function} collection
 * @param {Function} query
 * @param {Function} getDocs
 * @returns {Promise<Array<Object>>} normalized reviewer records
 */
export const getAvailableReviewers = async (db, collection, query, getDocs) => {
  try {
    const q = query(collection(db, 'Users'), where('role', '==', 'reviewer'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching available reviewers:', error);
    return [];
  }
};