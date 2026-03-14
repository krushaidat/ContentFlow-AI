import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";
import "../styles/team.css";

const ROLE_OPTIONS = ["user", "reviewer", "admin"];
//**DRAVEN This page allows admins to manage their team, including creating a team, inviting members, and assigning roles. 
// While users can only view the team and its members.*/
export default function Team() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = useMemo(() => me?.role === "admin", [me]);
/**DRAVEN
 * Loads current user profile, team metadata, and teammates.
 * Teammates are sourced from "Users" collection by matching teamId.
 * Also determines whether current user has admin privileges.
 */
  const loadTeamData = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError("");

    try {
      const meRef = doc(db, "Users", user.uid);
      const meSnap = await getDoc(meRef);
      if (!meSnap.exists()) throw new Error("User profile not found.");

      const meData = { uid: meSnap.id, ...meSnap.data() };
      setMe(meData);

      if (!meData.teamId) {
        setTeam(null);
        setMembers([]);
        return;
      }

      // Always fill teammates from Users by matching teamId
      const membersQ = query(
        collection(db, "Users"),
        where("teamId", "==", meData.teamId)
      );
      const membersSnap = await getDocs(membersQ);
      setMembers(membersSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));

      const teamRef = doc(db, "teams", meData.teamId);
      const teamSnap = await getDoc(teamRef);
      setTeam(
        teamSnap.exists()
          ? { id: teamSnap.id, ...teamSnap.data() }
          : { id: meData.teamId, name: "My Team" }
      );
    } catch (e) {
      setError(e.message || "Failed to load team data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, [user?.uid]);
//**DRAVEN This function allows admins to create a new team. The creator is automatically assigned as the admin of the team. */
  const handleCreateTeam = async () => {
    if (!teamName.trim() || !user?.uid) return;
    setSaving(true);
    setError("");
    try {
      const teamDoc = await addDoc(collection(db, "teams"), {
        name: teamName.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "Users", user.uid), {
        teamId: teamDoc.id,
        role: "admin",
      });

      setTeamName("");
      await loadTeamData();
    } catch (e) {
      setError(e.message || "Failed to create team.");
    } finally {
      setSaving(false);
    }
  };
//**DRAVEN This function allows admins to add members to their team by email. */
  const handleAddMemberByEmail = async () => {
    if (!inviteEmail.trim() || !team?.id || !isAdmin || !user?.uid) return;
    setSaving(true);
    setError("");
    try {
      // Call backend API to add member to team
      const response = await fetch("http://localhost:5000/api/team/add-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminId: user.uid,
          memberEmail: inviteEmail.trim().toLowerCase(),
          teamId: team.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add member.");
      }

      setInviteEmail("");
      await loadTeamData();
    } catch (e) {
      setError(e.message || "Failed to add member.");
    } finally {
      setSaving(false);
    }
  };
//**DRAVEN This function allows admins to change the role of team members. */
  const handleRoleChange = async (memberUid, newRole) => {
    if (!isAdmin || !team?.id || !user?.uid) return;
    setSaving(true);
    setError("");
    try {
      // Call backend API to change member role
      const response = await fetch("http://localhost:5000/api/team/change-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminId: user.uid,
          memberId: memberUid,
          newRole: newRole,
          teamId: team.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update role.");
      }

      await loadTeamData();
    } catch (e) {
      setError(e.message || "Failed to update role.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="team-page"><div className="team-card">Loading team...</div></div>;

  return (
    <div className="team-page">
      <div className="team-header">
        <h2>Team</h2>
        {team?.name ? <span className="team-pill">{team.name}</span> : null}
      </div>

      {error ? <p className="team-error">{error}</p> : null}

      {!team ? (
        <div className="team-card">
          {isAdmin ? (
            <>
              <p className="team-muted">You are not on a team yet.</p>
              <div className="team-inline">
                <input
                  className="team-input"
                  type="text"
                  placeholder="Team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
                <button className="team-btn" disabled={saving} onClick={handleCreateTeam}>
                  {saving ? "Creating..." : "Create Team"}
                </button>
              </div>
            </>
          ) : (
            <p className="team-muted">You are not assigned to a team yet.</p>
          )}
        </div>
      ) : (
        <>
          {isAdmin && (
            <div className="team-card">
              <h3 className="team-card-title">Manage Members</h3>
              <div className="team-inline">
                <input
                  className="team-input"
                  type="email"
                  placeholder="Add member by email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <button className="team-btn" disabled={saving} onClick={handleAddMemberByEmail}>
                  {saving ? "Adding..." : "Add Member"}
                </button>
              </div>
            </div>
          )}

          <div className="team-card">
            <h3 className="team-card-title">Teammates</h3>
            <div className="team-table-wrap">
              <table className="team-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.uid}>
                      <td>{(m.firstName || "") + " " + (m.lastName || "") || m.displayName || "Unknown"}</td>
                      <td>{m.email || "-"}</td>
                      <td>
                        {isAdmin ? (
                          <select
                            className="team-select"
                            value={m.role || "user"}
                            onChange={(e) => handleRoleChange(m.uid, e.target.value)}
                            disabled={saving}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="team-role">{m.role || "user"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!members.length && (
                    <tr>
                      <td colSpan={3} className="team-empty">No teammates yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}