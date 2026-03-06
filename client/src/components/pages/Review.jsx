import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import '../styles/dashboard.css';

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

  useEffect(() => {
    let isMounted = true;

    if (user?.role === 'reviewer' && user?.uid) {
      fetchAssignedContent();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  const fetchAssignedContent = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'content'),
        where('reviewerId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
      setAssignedItems(items);
      setError(null);
    } catch (err) {
      console.error("Error fetching assigned content:", err);
      setError("Failed to load assigned reviews.");
    } finally {
      setLoading(false);
    }
  };

  const handleView = (item) => {
    setViewingItem(item);
    setShowViewModal(true);
  };

  const handleApprove = async (itemId) => {
    try {
      setUpdatingId(itemId);
      await updateDoc(doc(db, 'content', itemId), {
        stage: 'Ready to Post',
        reviewedAt: new Date().toISOString(),
        reviewedBy: user.uid,
        reviewStatus: 'approved'
      });
      
      // Update local state
      setAssignedItems(assignedItems.map(item => 
        item.id === itemId 
          ? { ...item, stage: 'Ready to Post', reviewStatus: 'approved' }
          : item
      ));
      alert('Content approved successfully!');
    } catch (err) {
      console.error("Error approving content:", err);
      alert('Failed to approve content.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectClick = (itemId) => {
    setSelectedItemId(itemId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    try {
      setUpdatingId(selectedItemId);
      await updateDoc(doc(db, 'content', selectedItemId), {
        stage: 'Update',
        reviewedAt: new Date().toISOString(),
        reviewedBy: user.uid,
        reviewStatus: 'rejected',
        rejectionReason: rejectReason
      });
      
      // Update local state
      setAssignedItems(assignedItems.map(item => 
        item.id === selectedItemId 
          ? { ...item, stage: 'Update', reviewStatus: 'rejected', rejectionReason: rejectReason }
          : item
      ));
      
      setShowRejectModal(false);
      setRejectReason('');
      alert('Content rejected with feedback.');
    } catch (err) {
      console.error("Error rejecting content:", err);
      alert('Failed to reject content.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadgeClass = (stage) => {
    const statusMap = {
      draft: "badge-draft",
      planning: "badge-planning",
      review: "badge-review",
      update: "badge-update",
      "ready-to-post": "badge-ready",
    };
    return statusMap[stage?.toLowerCase()] || "badge-draft";
  };

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

  return (
    <div className="dashboard-main">
      <h2 className="dashboard-section-title">My Assigned Reviews</h2>

      {error && <div className="error-alert">{error}</div>}

      {assignedItems.length === 0 ? (
        <div className="empty-state">
          <p>No assigned reviews yet.</p>
        </div>
      ) : (
        <div className="dashboard-content-list">
          {assignedItems.map((item) => (
            <div key={item.id} className="dashboard-content-card content-item-box">
              <div className="dashboard-content-header">
                <span className={`dashboard-badge ${getStatusBadgeClass(item.stage)}`}>
                  {item.stage || "Draft"}
                </span>
                {item.reviewStatus && (
                  <span className={`review-status ${item.reviewStatus}`}>
                    {item.reviewStatus === 'approved' ? '✓ Approved' : '✗ Rejected'}
                  </span>
                )}
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
              
              <div className="dashboard-content-actions">
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
                <button 
                  className="icon-btn approve" 
                  title="Approve"
                  onClick={() => handleApprove(item.id)}
                  disabled={updatingId === item.id || item.reviewStatus === 'approved'}
                >
                  {updatingId === item.id ? '...' : '✓'}
                </button>
                <button 
                  className="icon-btn reject" 
                  title="Request Changes"
                  onClick={() => handleRejectClick(item.id)}
                  disabled={updatingId === item.id || item.reviewStatus === 'rejected'}
                >
                  {updatingId === item.id ? '...' : '✗'}
                </button>
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
              {viewingItem.rejectionReason && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                  <strong>Feedback from reviewer:</strong>
                  <p>{viewingItem.rejectionReason}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
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