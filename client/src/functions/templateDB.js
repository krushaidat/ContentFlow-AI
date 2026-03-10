import {collection, addDoc, getDocs, doc, deleteDoc, updateDoc, runTransaction} from 'firebase/firestore'
import {db} from '../firebase/'

/** DRAVEN
 *Adds a new template to the Firestore database.
@param {String} templateTitle - The title of the template to be added.
@param {String} templateContent - The content of the template to be added.
@returns {Promise<String>} -The id of the newly added template document in the Firestore database.
*/
export const addTemplate = async (templateTitle, templateContent) => {
    try {
        const nowIso = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'templates'), {
            title: templateTitle,
            content: templateContent,
            usageCount: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
            lastModifiedAt: nowIso,
            lastModified: new Date().toLocaleDateString()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding template:', error);
        throw error;
    }
};

/** DRAVEN
 * Fetches all templates from the Firestore database.
 * @returns {Promise<Array>} - An array of template objects, each containing the id, title, and content of a template.
 */
export const fetchTemplates = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, 'templates'));
        const templates = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() || {};
            const usageCount = Number(data.usageCount ?? data.popularity ?? data.views ?? 0) || 0;
            templates.push({
                id: doc.id,
                ...data,
                usageCount,
                createdAt: data.createdAt ?? data.created_at ?? null,
                updatedAt: data.updatedAt ?? data.lastModifiedAt ?? null,
            });
        });
        return templates;
    } catch (error) {
        console.error('Error fetching templates:', error);
        throw error;
    }
};

/** DRAVEN
 * Deletes a template from the Firestore database based on the provided template ID.
 * @param {String} templateId - The ID of the template to be deleted.
 * @returns {Promise<void>} - A promise that resolves when the template is successfully deleted.
 */
export const deleteTemplate = async (templateId) => {
    try {
        await deleteDoc(doc(db, 'templates', templateId));
    } catch (error) {
        console.error('Error deleting template:', error);
        throw error;
    }
};

/** DRAVEN
 * Updates an existing template in the Firestore database.
 * @param {String} templateId - The ID of the template to update.
 * @param {String} templateTitle - The updated template title.
 * @param {String} templateContent - The updated template content.
 * @returns {Promise<void>} - A promise that resolves when the update completes.
 */
export const updateTemplate = async (templateId, templateTitle, templateContent) => {
    try {
        const nowIso = new Date().toISOString();
        await updateDoc(doc(db, 'templates', templateId), {
            title: templateTitle,
            content: templateContent,
            updatedAt: nowIso,
            lastModifiedAt: nowIso,
            lastModified: new Date().toLocaleDateString()
        });
    } catch (error) {
        console.error('Error updating template:', error);
        throw error;
    }
};

/**
 * Increments the usage count for a template document. Used to track how often
 * a template is selected to create content so we can sort by "most popular".
 * @param {String} templateId
 */
export const incrementTemplateUsage = async (templateId) => {
    try {
        if (!templateId) return;
        const templateRef = doc(db, 'templates', templateId);
        await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(templateRef);
            if (!snapshot.exists()) return;

            const current = Number(snapshot.data()?.usageCount ?? 0) || 0;
            transaction.update(templateRef, {
                usageCount: current + 1,
                updatedAt: new Date().toISOString(),
            });
        });
    } catch (error) {
        console.error('Error incrementing template usage:', error);
        throw error;
    }
};

/**
 * Decrements the usage count for a template document when related content is deleted.
 * The value is clamped at 0 to avoid negative counts.
 * @param {String} templateId
 */
export const decrementTemplateUsage = async (templateId) => {
    try {
        if (!templateId) return;
        const templateRef = doc(db, 'templates', templateId);
        await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(templateRef);
            if (!snapshot.exists()) return;

            const current = Number(snapshot.data()?.usageCount ?? 0) || 0;
            const next = Math.max(0, current - 1);
            transaction.update(templateRef, {
                usageCount: next,
                updatedAt: new Date().toISOString(),
            });
        });
    } catch (error) {
        console.error('Error decrementing template usage:', error);
        throw error;
    }
};
