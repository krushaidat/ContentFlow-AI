import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import useInPageAlert from '../../hooks/useInPageAlert';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import InPageAlert from '../InPageAlert';
import {
  REVIEW_STATUS,
  REVIEW_STATUS_LABEL,
  deriveReviewStatus,
} from './workflowPage/constants';
import '../styles/dashboard.css';
import '../styles/review.css';

// Filter tabs
const FILTER_ALL = 'ALL';
const REVIEW_FILTERS = [
  { key: FILTER_ALL, label: 'All Content' },
  { key: REVIEW_STATUS.ASSIGNED, label: 'Assigned' },
  { key: REVIEW_STATUS.APPROVED, label: 'Approved' },
  { key: REVIEW_STATUS.REJECTED, label: 'Rejected' },
];

// Convert Firestore/ISO timestamps to milliseconds
const toTime = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') {
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.floor(nanos / 1e6);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

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
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(-1);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionViewMode, setVersionViewMode] = useState('view');
  const [highlightedContentId, setHighlightedContentId] = useState(null);
  const [activeFilter, setActiveFilter] = useState(FILTER_ALL);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertItemId, setRevertItemId] = useState(null);
  const [revertTarget, setRevertTarget] = useState('assigned'); // 'assigned' | 'rejected'
  const [revertReason, setRevertReason] = useState('');
  const location = useLocation();
  const { alertState, showAlert, dismissAlert } = useInPageAlert();

  // Highlight notification on mount
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
        // Sorting/filtering handled in useMemo below
        const items = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

  const visibleItems = useMemo(() => {
    const withStatus = assignedItems.map((item) => ({
      item,
      status: deriveReviewStatus(item) || REVIEW_STATUS.ASSIGNED,
    }));

    const filtered =
      activeFilter === FILTER_ALL
        ? withStatus
        : withStatus.filter((entry) => entry.status === activeFilter);

    const sorted = filtered.sort((a, b) => {
      if (activeFilter === REVIEW_STATUS.REJECTED) {
        const aT = toTime(a.item.rejectedAt) || toTime(a.item.reviewedAt);
        const bT = toTime(b.item.rejectedAt) || toTime(b.item.reviewedAt);
        if (aT || bT) return bT - aT;
      } else if (activeFilter === REVIEW_STATUS.APPROVED) {
        const aT = toTime(a.item.approvedAt) || toTime(a.item.reviewedAt);
        const bT = toTime(b.item.approvedAt) || toTime(b.item.reviewedAt);
        if (aT || bT) return bT - aT;
      }

      // Float resubmitted items to top
      if (activeFilter === REVIEW_STATUS.ASSIGNED || activeFilter === FILTER_ALL) {
        const aResub = Boolean(a.item.wasResubmitted);
        const bResub = Boolean(b.item.wasResubmitted);
        if (aResub !== bResub) return aResub ? -1 : 1;
        if (aResub && bResub) {
          const aR = toTime(a.item.resubmittedAt);
          const bR = toTime(b.item.resubmittedAt);
          if (aR || bR) return bR - aR;
        }
      }

      // Default: newest createdAt first
      return toTime(b.item.createdAt) - toTime(a.item.createdAt);
    });

    return sorted.map((entry) => ({ ...entry.item, _status: entry.status }));
  }, [assignedItems, activeFilter]);

  // Tab badge counts
  const filterCounts = useMemo(() => {
    const counts = {
      [FILTER_ALL]: assignedItems.length,
      [REVIEW_STATUS.ASSIGNED]: 0,
      [REVIEW_STATUS.APPROVED]: 0,
      [REVIEW_STATUS.REJECTED]: 0,
    };
    for (const item of assignedItems) {
      const status = deriveReviewStatus(item) || REVIEW_STATUS.ASSIGNED;
      if (counts[status] !== undefined) counts[status] += 1;
    }
    return counts;
  }, [assignedItems]);

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

      const nowIso = new Date().toISOString();
      setAssignedItems(assignedItems.map(item =>
        item.id === itemId
          ? {
              ...item,
              stage: 'Ready To Post',
              reviewStatus: 'approved',
              reviewStatusCode: REVIEW_STATUS.APPROVED,
              approvedAt: nowIso,
              reviewedAt: nowIso,
              rejectionReason: undefined,
              rejectedAt: undefined,
              // Mirror backend state locally for instant UI update
              wasResubmitted: undefined,
              resubmittedAt: undefined,
              previousRejectionReason: undefined,
              previousRejectedAt: undefined,
            }
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

      const nowIso = new Date().toISOString();
      setAssignedItems(assignedItems.map(item =>
        item.id === itemId
          ? {
              ...item,
              stage: 'Update',
              reviewStatus: 'rejected',
              reviewStatusCode: REVIEW_STATUS.REJECTED,
              rejectionReason: rejectReason,
              rejectedAt: nowIso,
              reviewedAt: nowIso,
              approvedAt: undefined,
              // Mirror backend state locally for instant UI update
              wasResubmitted: undefined,
              resubmittedAt: undefined,
              previousRejectionReason: undefined,
              previousRejectedAt: undefined,
            }
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

  /**
   * Opens the revert modal for an approved item. Default revert target is
   * "assigned" (put it back in the queue as a fresh assignment), but the
   * reviewer can switch to "rejected" and supply feedback instead.
   */
  const openRevertModal = (itemId) => {
    setRevertItemId(itemId);
    setRevertTarget('assigned');
    setRevertReason('');
    setShowRevertModal(true);
  };

  const handleRevertSubmit = async () => {
    if (!revertItemId) return;

    if (revertTarget === 'rejected' && !revertReason.trim()) {
      showAlert('Please provide feedback when reverting to rejected.', 'warning');
      return;
    }

    try {
      setUpdatingId(revertItemId);
      const response = await fetch('http://localhost:5000/api/team/review-revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: user.uid,
          contentId: revertItemId,
          target: revertTarget,
          rejectionReason: revertTarget === 'rejected' ? revertReason : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to revert approval.');
      }

      const nowIso = new Date().toISOString();
      setAssignedItems(assignedItems.map(item => {
        if (item.id !== revertItemId) return item;
        if (revertTarget === 'rejected') {
          return {
            ...item,
            stage: 'Update',
            reviewStatus: 'rejected',
            reviewStatusCode: REVIEW_STATUS.REJECTED,
            rejectionReason: revertReason.trim(),
            rejectedAt: nowIso,
            reviewedAt: nowIso,
            approvedAt: undefined,
              // Mirror backend state locally
            wasResubmitted: undefined,
            resubmittedAt: undefined,
            previousRejectionReason: undefined,
            previousRejectedAt: undefined,
          };
        }
        return {
          ...item,
          stage: 'Review',
          reviewStatus: undefined,
          reviewStatusCode: REVIEW_STATUS.ASSIGNED,
          rejectionReason: undefined,
          rejectedAt: undefined,
          approvedAt: undefined,
          reviewedAt: nowIso,
          // Mirror backend state locally
          wasResubmitted: undefined,
          resubmittedAt: undefined,
          previousRejectionReason: undefined,
          previousRejectedAt: undefined,
        };
      }));

      setShowRevertModal(false);
      setRevertItemId(null);
      setRevertReason('');
      setRevertTarget('assigned');
      showAlert(
        revertTarget === 'rejected'
          ? 'Approval reverted — changes requested.'
          : 'Approval reverted — content is back in the review queue.',
        'success'
      );
    } catch (err) {
      console.error('Error reverting approval:', err);
      showAlert(err.message || 'Failed to revert approval.', 'error');
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

  /**
   * Renders the small status pill shown next to the stage badge on each card.
   * Uses the derived REVIEW_STATUS so ASSIGNED items show an explicit "NEW"
   * style instead of nothing at all.
   */
  const renderStatusPill = (status) => {
    if (!status) return null;
    const label = REVIEW_STATUS_LABEL[status] || status;
    const icon =
      status === REVIEW_STATUS.APPROVED ? '✓'
      : status === REVIEW_STATUS.REJECTED ? '✗'
      : '●';
    return (
      <span className={`review-status ${status.toLowerCase()}`}>
        {icon} {label}
      </span>
    );
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

  const viewingStatus = viewingItem ? deriveReviewStatus(viewingItem) : null;

  return (
    <div className="dashboard-main">
      <InPageAlert alertState={alertState} onClose={dismissAlert} />
      <h2 className="dashboard-section-title">My Assigned Reviews</h2>

      {/* Filter tabs: All / Assigned / Approved / Rejected */}
      <div className="review-filter-tabs" role="tablist" aria-label="Review status filter">
        {REVIEW_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          const count = filterCounts[filter.key] ?? 0;
          return (
            <button
              key={filter.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`review-filter-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter.key)}
            >
              <span className="review-filter-tab-label">{filter.label}</span>
              <span className="review-filter-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="error-alert">{error}</div>}

      {visibleItems.length === 0 ? (
        <div className="empty-state">
          <p>
            {activeFilter === FILTER_ALL
              ? 'No assigned reviews yet.'
              : `No ${REVIEW_STATUS_LABEL[activeFilter]?.toLowerCase() || ''} items.`}
          </p>
        </div>
      ) : (
        <div className="dashboard-content-list">
          {visibleItems.map((item) => {
            const itemStatus = item._status;
            const isApproved = itemStatus === REVIEW_STATUS.APPROVED;
            const isRejected = itemStatus === REVIEW_STATUS.REJECTED;
            const isResubmitted =
              Boolean(item.wasResubmitted) && itemStatus === REVIEW_STATUS.ASSIGNED;
            return (
              <div key={item.id} className={`dashboard-content-card content-item-box ${highlightedContentId === item.id ? 'notification-highlight' : ''} ${isResubmitted ? 'is-resubmitted' : ''}`}>
                <div className="dashboard-content-header">
{/*Tanvir- 
- Moved view button to top-right of each card header
- Badges now grouped with buttons in header section*/}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className={`dashboard-badge ${getStatusBadgeClass(item.stage)}`}>
                      {item.stage || "Draft"}
                    </span>
                    {renderStatusPill(itemStatus)}
                    {isResubmitted && (
                      <span
                        className="review-status resubmitted"
                        title="Author updated this item after your feedback and resubmitted it for review."
                      >
                        ⟳ Resubmitted
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

                {/* Current-cycle rejection feedback (red). Never shown for
                    resubmitted items — once the author resubmits, the old
                    feedback becomes *previous* feedback and renders in the
                    blue info banner below instead. */}
                {item.rejectionReason && !isResubmitted && (
                  <div className="rejection-reason">
                    <strong>Feedback:</strong> {item.rejectionReason}
                  </div>
                )}

                {/* Preserved context for a resubmitted item: the old feedback
                    the reviewer gave, shown in an informational (blue) tone so
                    it's clearly distinct from an active rejection. */}
                {isResubmitted && item.previousRejectionReason && (
                  <div className="previous-feedback">
                    <strong>Previously rejected feedback:</strong>
                    <p>{item.previousRejectionReason}</p>
                    <small>
                      Author has updated this content and resubmitted it for review.
                    </small>
                  </div>
                )}

                <div className="content-item-meta">
                  <span className="content-item-stage">Stage: {item.stage || "Draft"}</span>
                  <span className="content-item-date">
                    {isResubmitted && item.resubmittedAt
                      ? `Resubmitted ${formatDate(item.resubmittedAt)}`
                      : isRejected && item.rejectedAt
                      ? `Rejected ${formatDate(item.rejectedAt)}`
                      : isApproved && item.approvedAt
                      ? `Approved ${formatDate(item.approvedAt)}`
                      : item.createdAt
                      ? formatDate(item.createdAt)
                      : "Invalid Date"}
                  </span>
                </div>

                <div className="dashboard-content-type">
                  {item.type || item.template || item.category || item.name || "Company Announcement"}
                </div>

                {/* Revert action available only on approved items */}
                {isApproved && (
                  <div className="review-card-actions">
                    <button
                      type="button"
                      className="btn-revert"
                      onClick={() => openRevertModal(item.id)}
                      disabled={updatingId === item.id}
                    >
                      ↺ Revert approval
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
                            : version.changeType === 'review_reverted' ? 'Reverted'
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

              {viewingItem.wasResubmitted && viewingItem.previousRejectionReason && (
                <div className="previous-feedback" style={{ marginTop: '1rem' }}>
                  <strong>Previously rejected feedback:</strong>
                  <p>{viewingItem.previousRejectionReason}</p>
                  <small>
                    Author has updated this content and resubmitted it for review
                    {viewingItem.resubmittedAt ? ` on ${formatDate(viewingItem.resubmittedAt)}` : ''}.
                  </small>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
              <div className="modal-actions">
                {viewingStatus === REVIEW_STATUS.APPROVED ? (
                  <button
                    className="btn-revert"
                    onClick={() => {
                      openRevertModal(viewingItem.id);
                      setShowViewModal(false);
                    }}
                    disabled={updatingId === viewingItem.id}
                  >
                    ↺ Revert approval
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-approve"
                      onClick={() => {
                        handleApprove(viewingItem.id);
                        setShowViewModal(false);
                      }}
                      disabled={updatingId === viewingItem.id}
                    >
                      {updatingId === viewingItem.id ? 'Approving...' : '✓ Approve'}
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => {
                        setShowRejectModal(true);
                        setShowViewModal(false);
                      }}
                      disabled={updatingId === viewingItem.id}
                    >
                      ✗ Request Changes
                    </button>
                  </>
                )}
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

      {/* Revert Approval Modal */}
      {showRevertModal && (
        <div className="modal-overlay" onClick={() => setShowRevertModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Revert approval</h3>
              <button className="modal-close" onClick={() => setShowRevertModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0 }}>
                Choose what to do with this content after reverting the approval.
              </p>
              <div className="revert-target-options">
                <label className="revert-target-option">
                  <input
                    type="radio"
                    name="revertTarget"
                    value="assigned"
                    checked={revertTarget === 'assigned'}
                    onChange={() => setRevertTarget('assigned')}
                  />
                  <span>
                    <strong>Back to review queue</strong>
                    <small>Moves to Review stage as a fresh assignment.</small>
                  </span>
                </label>
                <label className="revert-target-option">
                  <input
                    type="radio"
                    name="revertTarget"
                    value="rejected"
                    checked={revertTarget === 'rejected'}
                    onChange={() => setRevertTarget('rejected')}
                  />
                  <span>
                    <strong>Reject with feedback</strong>
                    <small>Moves to Update stage so the author can revise.</small>
                  </span>
                </label>
              </div>

              {revertTarget === 'rejected' && (
                <>
                  <label style={{ marginTop: '16px' }}>Feedback (required):</label>
                  <textarea
                    value={revertReason}
                    onChange={(e) => setRevertReason(e.target.value)}
                    placeholder="Explain what changes are needed..."
                    rows="5"
                    style={{ width: '100%', padding: '8px', marginTop: '8px' }}
                  />
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRevertModal(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleRevertSubmit}
                disabled={
                  updatingId === revertItemId ||
                  (revertTarget === 'rejected' && !revertReason.trim())
                }
              >
                {updatingId === revertItemId ? 'Reverting...' : 'Confirm revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewPage;