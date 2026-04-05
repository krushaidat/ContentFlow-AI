import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import useInPageAlert from '../../hooks/useInPageAlert';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import InPageAlert from '../InPageAlert';
import '../styles/dashboard.css';
import '../styles/review.css';

const ReviewPage = () => {
  const { user } = useAuth();
  const [assignedItems, setAssignedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  // Aminah updated: state for version history panel inside the review modal — which snapshot is selected, whether the panel is visible, and view vs compare mode.
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(-1);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionViewMode, setVersionViewMode] = useState('view');
  const [highlightedContentId, setHighlightedContentId] = useState(null);
  const location = useLocation();
  const { alertState, showAlert, dismissAlert } = useInPageAlert();

  // Handle notification highlight on arrival
  useEffect(() => {
    if (location.state?.highlightContentId) {
      setHighlightedContentId(location.state.highlightContentId);
      const timer = setTimeout(() => {
        setHighlightedContentId(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state?.highlightContentId]);

  /**DRAVEN
   * Streams assigned content in real time for the logged-in reviewer.
   * Access is restricted to users with reviewer role.
   */
  // Aminah update: switched reviewer assignments from one-time fetch to Firestore onSnapshot so new assignments appear instantly without page refresh.
  useEffect(() => {
    if (user?.role !== 'reviewer' || !user?.uid) {
      setAssignedItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'content'),
      where('reviewerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const items = querySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const aTime = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : Number(a.createdAt || 0);
            const bTime = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : Number(b.createdAt || 0);
            return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
          });

        setAssignedItems(items);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error streaming assigned content:', err);
        setError('Failed to load assigned reviews.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.role, user?.uid]);

  /**DRAVEN
   * Opens the detail modal for a selected content item.
   * @param {Object} item - Content item to preview/review.
   */
  // Aminah updated: when opening a content item for review, initialise version history state so the panel always starts collapsed on the latest snapshot.
  const handleView = (item) => {
    setViewingItem(item);
    const history = Array.isArray(item?.versionHistory) ? item.versionHistory : [];
    setSelectedVersionIndex(history.length > 0 ? history.length - 1 : -1);
    setShowVersionHistory(false);
    setVersionViewMode('view');
    setShowViewModal(true);
  };

  // Aminah updated: converts a versionHistory snapshotAt value to a readable local date/time string.
  const formatVersionTimestamp = (value) => {
    if (!value) return 'Unknown time';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown time';
    return parsed.toLocaleString();
  };

  // Aminah updated: returns true when a field value differs between a past snapshot and the current content, used to highlight changed fields in compare mode.
  const hasFieldChanged = (snapshot, field, current) => {
    return (snapshot?.[field] || '') !== (current?.[field] || '');
  };

  /**DRAVEN
   * Approves a content item and moves it to "Ready to Post".
   * Also stores review metadata and updates local list state.
   * @param {string} itemId - Firestore document id for the content item.
   */
  const handleApprove = async (itemId) => {
    try {
      setUpdatingId(itemId);
      const response = await fetch('http://localhost:5000/api/team/review-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewerId: user.uid,
          contentId: itemId,
          decision: 'approved',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve content.');
      }
      
      setAssignedItems(assignedItems.map(item => 
        item.id === itemId 
          ? { ...item, stage: 'Ready To Post', reviewStatus: 'approved', rejectionReason: undefined }
          : item
      ));
      showAlert('Content approved successfully!', 'success');
    } catch (err) {
      console.error("Error approving content:", err);
      showAlert('Failed to approve content.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  /**DRAVEN
   * Submits rejection feedback and moves item back to "Update" stage.
   * Requires non-empty feedback to ensure actionable comments for author.
   */
  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      showAlert('Please provide a reason for rejection.', 'warning');
      return;
    }

    const itemId = selectedItemId || viewingItem?.id; // Use viewingItem.id as fallback

    if (!itemId) {
      showAlert('Error: Could not identify item to reject.', 'error');
      return;
    }

    try {
      setUpdatingId(itemId);
      const response = await fetch('http://localhost:5000/api/team/review-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewerId: user.uid,
          contentId: itemId,
          decision: 'rejected',
          rejectionReason: rejectReason,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject content.');
      }
      
      setAssignedItems(assignedItems.map(item => 
        item.id === itemId 
          ? { ...item, stage: 'Update', reviewStatus: 'rejected', rejectionReason: rejectReason }
          : item
      ));
      
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedItemId(null);
      showAlert('Content rejected with feedback.', 'success');
    } catch (err) {
      console.error("Error rejecting content:", err);
      showAlert('Failed to reject content.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  /**DRAVEN
   * Maps a stage value to its badge CSS class.
   * Keeps stage-style mapping centralized for consistent UI.
   * @param {string} stage
   * @returns {string} badge class name
   */
  const getStatusBadgeClass = (stage) => {
    const statusMap = {
      draft: "badge-draft",
      planning: "badge-planning",
      review: "badge-review",
      update: "badge-update",
      "ready-to-post": "badge-ready",
      "ready to post": "badge-ready",
    };
    return statusMap[stage?.toLowerCase()] || "badge-draft";
  };

  /**DRAVEN
   * Formats ISO/timestamp values for card metadata display.
   * @param {string|number|Date} dateString
   * @returns {string} human-readable date
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (user?.role !== 'reviewer') {
    return <div style={{ padding: '20px' }}>Access denied. You must have reviewer role.</div>;
  }

  if (loading) return <div className="loading">Loading your assigned reviews...</div>;

  const versionHistory = Array.isArray(viewingItem?.versionHistory)
    ? viewingItem.versionHistory
    : [];
  const selectedSnapshot =
    selectedVersionIndex >= 0 && selectedVersionIndex < versionHistory.length
      ? versionHistory[selectedVersionIndex]
      : null;

  return (
    <div className="dashboard-main">
      <InPageAlert alertState={alertState} onClose={dismissAlert} />
      <h2 className="dashboard-section-title">My Assigned Reviews</h2>

      {error && <div className="error-alert">{error}</div>}

      {assignedItems.length === 0 ? (
        <div className="empty-state">
          <p>No assigned reviews yet.</p>
        </div>
      ) : (
        <div className="dashboard-content-list">
          {assignedItems.map((item) => (
            <div key={item.id} className={`dashboard-content-card content-item-box ${highlightedContentId === item.id ? 'notification-highlight' : ''}`}>
              <div className="dashboard-content-header">
{/*Tanvir- 
- Moved view button to top-right of each card header
- Badges now grouped with buttons in header section*/}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`dashboard-badge ${getStatusBadgeClass(item.stage)}`}>
                    {item.stage || "Draft"}
                  </span>
                  {item.reviewStatus && (
                    <span className={`review-status ${item.reviewStatus}`}>
                      {item.reviewStatus === 'approved' ? '✓ Approved' : '✗ Rejected'}
                    </span>
                  )}
                </div>
                <button 
                  className="icon-btn view" 
                  title="View"
                  onClick={() => handleView(item)}
                  disabled={updatingId}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
              
              <div className="content-item-title">{item.title}</div>
              <div className="content-item-text">{item.text}</div>
              
              {item.rejectionReason && (
                <div className="rejection-reason">
                  <strong>Feedback:</strong> {item.rejectionReason}
                </div>
              )}
              
              <div className="content-item-meta">
                <span className="content-item-stage">Stage: {item.stage || "Draft"}</span>
                <span className="content-item-date">
                  {item.createdAt ? formatDate(item.createdAt) : "Invalid Date"}
                </span>
              </div>
              
              <div className="dashboard-content-type">
                {item.type || item.template || item.category || item.name || "Company Announcement"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingItem && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewingItem.title}</h3>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p><strong>Stage:</strong> {viewingItem.stage}</p>
              <p><strong>Content:</strong></p>
              <p>{viewingItem.text}</p>

              {/* Aminah updated: toggle button to show or hide the version history panel inside the review modal. */}
              <button
                className="btn-toggle-history"
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                style={{ marginTop: '1rem', marginBottom: '1rem' }}
              >
                {showVersionHistory ? 'Hide' : 'Show'} Version History
              </button>

              {/* Aminah updated: version history panel — version selector dropdown, view-only mode, and side-by-side compare mode with changed-field highlighting. */}
              {showVersionHistory && (
                <div className="compare-view-block">
                  <div className="compare-view-header-row">
                    {selectedSnapshot && (
                      <div className="history-view-toggle">
                        <button
                          type="button"
                          className={`history-toggle-btn ${versionViewMode === 'view' ? 'active' : ''}`}
                          onClick={() => setVersionViewMode('view')}
                        >
                          View version
                        </button>
                        <button
                          type="button"
                          className={`history-toggle-btn ${versionViewMode === 'compare' ? 'active' : ''}`}
                          onClick={() => setVersionViewMode('compare')}
                        >
                          Compare
                        </button>
                      </div>
                    )}
                    <select
                      className="compare-version-select"
                      value={selectedVersionIndex}
                      onChange={(e) => {
                        setSelectedVersionIndex(Number(e.target.value));
                        setVersionViewMode('view');
                      }}
                    >
                      <option value={-1}>Current version only</option>
                      {versionHistory.map((version, idx) => (
                        <option key={`${version.snapshotAt || 'v'}-${idx}`} value={idx}>
                          {`v${idx + 1} · ${formatVersionTimestamp(version.snapshotAt)} · ${
                            version.changeType === 'manual_edit' ? 'Manual edit'
                            : version.changeType === 'review_approved' ? 'Approved'
                            : version.changeType === 'review_rejected' ? 'Rejected'
                            : version.changeType || 'Edit'
                          }`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {versionViewMode === 'view' && selectedSnapshot ? (
                    <div className="compare-grid compare-grid-single">
                      <div className="compare-card old-version">
                        <div className="compare-card-title">Past Version (v{selectedVersionIndex + 1})</div>
                        <p>
                          <strong>Title:</strong> {selectedSnapshot.title || '(empty)'}
                        </p>
                        <p>
                          <strong>Stage:</strong> {selectedSnapshot.stage || 'Draft'}
                        </p>
                        <p>
                          <strong>Text:</strong> {selectedSnapshot.text || '(empty)'}
                        </p>
                        <p className="history-snapshot-meta">Saved: {formatVersionTimestamp(selectedSnapshot.snapshotAt)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className={`compare-grid ${selectedSnapshot ? '' : 'compare-grid-single'}`}>
                      {selectedSnapshot && (
                        <div className="compare-card old-version">
                          <div className="compare-card-title">Past Version (v{selectedVersionIndex + 1})</div>
                          <p className={hasFieldChanged(selectedSnapshot, 'title', viewingItem) ? 'compare-changed' : ''}>
                            <strong>Title:</strong> {selectedSnapshot.title || '(empty)'}
                          </p>
                          <p className={hasFieldChanged(selectedSnapshot, 'stage', viewingItem) ? 'compare-changed' : ''}>
                            <strong>Stage:</strong> {selectedSnapshot.stage || 'Draft'}
                          </p>
                          <p className={hasFieldChanged(selectedSnapshot, 'text', viewingItem) ? 'compare-changed' : ''}>
                            <strong>Text:</strong> {selectedSnapshot.text || '(empty)'}
                          </p>
                          <p className="history-snapshot-meta">Saved: {formatVersionTimestamp(selectedSnapshot.snapshotAt)}</p>
                        </div>
                      )}

                      <div className="compare-card new-version current-version-card">
                        <div className="compare-card-title">Current Version</div>
                        <p className={selectedSnapshot && hasFieldChanged(selectedSnapshot, 'title', viewingItem) ? 'compare-changed' : ''}>
                          <strong>Title:</strong> {viewingItem.title || '(empty)'}
                        </p>
                        <p className={selectedSnapshot && hasFieldChanged(selectedSnapshot, 'stage', viewingItem) ? 'compare-changed' : ''}>
                          <strong>Stage:</strong> {viewingItem.stage || 'Draft'}
                        </p>
                        <p className={selectedSnapshot && hasFieldChanged(selectedSnapshot, 'text', viewingItem) ? 'compare-changed' : ''}>
                          <strong>Text:</strong> {viewingItem.text || '(empty)'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {viewingItem.rejectionReason && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                  <strong>Feedback from reviewer:</strong>
                  <p>{viewingItem.rejectionReason}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
              <div className="modal-actions">
                <button 
                  className="btn-approve"
                  onClick={() => {
                    handleApprove(viewingItem.id);
                    setShowViewModal(false);
                  }}
                  disabled={updatingId === viewingItem.id || viewingItem.reviewStatus === 'approved'}
                >
                  {updatingId === viewingItem.id ? 'Approving...' : '✓ Approve'}
                </button>
                <button 
                  className="btn-reject"
                  onClick={() => {
                    setShowRejectModal(true);
                    setShowViewModal(false);
                  }}
                  disabled={updatingId === viewingItem.id || viewingItem.reviewStatus === 'rejected'}
                >
                  ✗ Request Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Request Changes</h3>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label>Feedback (required):</label>
              <textarea 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain what changes are needed..."
                rows="5"
                style={{ width: '100%', padding: '8px', marginTop: '8px' }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim()}
              >
                Send Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewPage;