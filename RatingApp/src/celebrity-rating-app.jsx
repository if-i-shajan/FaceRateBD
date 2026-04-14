import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

function humanizeSupabaseError(err) {
  if (!err?.message) return "Could not save rating.";
  const msg = err.message;
  if (/row-level security|RLS|permission denied|42501/i.test(msg + (err.code || ""))) {
    return "Database blocked this save (Row Level Security). Open Supabase → SQL and run the script in RatingApp/supabase/rls_policies.sql.";
  }
  if (/no unique or exclusion constraint matching/i.test(msg)) {
    return "Add a UNIQUE constraint on ratings(photo_id, user_id). Uncomment the CREATE UNIQUE INDEX line in RatingApp/supabase/rls_policies.sql and run it.";
  }
  return msg;
}

function parseStoredJson(value, fallback) {
  if (value == null) return fallback;
  if (Array.isArray(value) || typeof value === "object") return value;
  if (typeof value !== "string") return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/* ═══════════════════════════════ SUPABASE OPERATIONS ═════════════════════════════════════ */
const DB = {
  // Users operations
  async getUser(id) {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single();
    if (error && error.code !== "PGRST116") console.error("Fetch user error:", error);
    return data || null;
  },
  async upsertUser(user) {
    const { error } = await supabase.from("users").upsert([user], { onConflict: "id" });
    if (error) console.error("Upsert user error:", error);
    return !error;
  },
  async getAllUsers() {
    const { data, error } = await supabase.from("users").select("*");
    if (error) console.error("Fetch users error:", error);
    return data || [];
  },

  // Photos operations
  async getPhotos() {
    const { data, error } = await supabase.from("photos").select("*");
    if (error) console.error("Fetch photos error:", error);
    const photos = {};
    (data || []).forEach(p => { photos[p.id] = p; });
    return photos;
  },
  async addPhoto(photo) {
    const { error } = await supabase.from("photos").insert([photo]);
    if (error) console.error("Insert photo error:", error);
    return !error;
  },
  async deletePhoto(photoId) {
    const { error } = await supabase.from("photos").delete().eq("id", photoId);
    if (error) console.error("Delete photo error:", error);
    return !error;
  },

  // Ratings operations
  async getRatings() {
    const { data, error } = await supabase.from("ratings").select("*");
    if (error) console.error("Fetch ratings error:", error);
    const ratings = {};
    (data || []).forEach(r => {
      if (!ratings[r.photo_id]) ratings[r.photo_id] = {};
      ratings[r.photo_id][r.user_id] = { rating: r.rating, comment: r.comment, ratedAt: r.created_at };
    });
    return ratings;
  },
  async addRating(rating) {
    // Validate inputs
    if (!rating.photo_id || !rating.user_id || !rating.rating) {
      return { ok: false, error: "Missing required rating data" };
    }

    if (rating.rating < 1 || rating.rating > 10) {
      return { ok: false, error: "Rating must be between 1 and 10" };
    }

    const row = {
      id: crypto.randomUUID(),
      photo_id: String(rating.photo_id),
      user_id: String(rating.user_id),
      rating: parseInt(rating.rating),
      comment: null,
      created_at: new Date().toISOString()
    };

    // Try to insert
    const { error: insertErr } = await supabase.from("ratings").insert([row]);
    if (!insertErr) return { ok: true };

    // Check if it's a duplicate key error
    const isDup =
      insertErr.code === "23505" ||
      /duplicate|unique|conflict/i.test(insertErr.message);

    if (isDup) {
      // Update existing rating
      const { error: updErr } = await supabase
        .from("ratings")
        .update({ rating: row.rating, comment: null, created_at: row.created_at })
        .eq("photo_id", row.photo_id)
        .eq("user_id", row.user_id);

      if (!updErr) return { ok: true };
      console.error("Update rating error:", updErr);
      return { ok: false, error: humanizeSupabaseError(updErr) };
    }

    console.error("Insert rating error:", insertErr);
    return { ok: false, error: humanizeSupabaseError(insertErr) };
  },

  // User progress operations
  async getProgress(userId) {
    if (!userId) {
      console.warn("getProgress called with no userId");
      return { ratedIds: [], sessionQueue: null, sessionIdx: 0 };
    }

    try {
      const { data, error } = await supabase.from("user_progress").select("*").eq("user_id", String(userId)).single();

      if (error) {
        if (error.code !== "PGRST116") {
          console.error("Fetch progress error:", error);
        }
        return { ratedIds: [], sessionQueue: null, sessionIdx: 0 };
      }

      if (data) {
        return {
          ratedIds: parseStoredJson(data.rated_ids, []),
          sessionQueue: parseStoredJson(data.session_queue, null),
          sessionIdx: Number.isInteger(data.session_idx) ? Math.max(0, data.session_idx) : 0
        };
      }
      return { ratedIds: [], sessionQueue: null, sessionIdx: 0 };
    } catch (e) {
      console.error("getProgress exception:", e);
      return { ratedIds: [], sessionQueue: null, sessionIdx: 0 };
    }
  },
  async updateProgress(userId, progress) {
    if (!userId) {
      console.error("Cannot update progress: no userId");
      return false;
    }

    try {
      const ratedIds = Array.isArray(progress.ratedIds) ? progress.ratedIds : [];
      const sessionQueue = Array.isArray(progress.sessionQueue)
        ? progress.sessionQueue.map(p => typeof p === 'object' ? p.id : p).filter(Boolean)
        : null;

      const { error } = await supabase.from("user_progress").upsert([{
        user_id: String(userId),
        rated_ids: JSON.stringify(ratedIds),
        session_queue: sessionQueue ? JSON.stringify(sessionQueue) : null,
        session_idx: Math.max(0, parseInt(progress.sessionIdx) || 0),
        updated_at: new Date().toISOString()
      }], { onConflict: "user_id" });

      if (error) {
        console.error("Update progress error:", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("Update progress exception:", e);
      return false;
    }
  }
};

/* ═══════════════════════ ULTRA-RANDOM SHUFFLE (Multiple passes for max unpredictability) ════════════════ */
function strongShuffle(arr) {
  const shuffled = [...arr];
  const len = shuffled.length;

  // Multiple passes with different strategies for maximum randomness
  // Pass 1: Fisher-Yates forward
  for (let i = 0; i < len - 1; i++) {
    const j = i + Math.floor(Math.random() * (len - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Pass 2: Fisher-Yates reverse (different direction)
  for (let i = len - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Pass 3: Random block swaps for extra randomization
  for (let i = 0; i < len * 0.3; i++) {
    const a = Math.floor(Math.random() * len);
    const b = Math.floor(Math.random() * len);
    if (a !== b) {
      [shuffled[a], shuffled[b]] = [shuffled[b], shuffled[a]];
    }
  }

  return shuffled;
}

const ADMIN_PASS = "adminbaby";
const SESS_MAX = 500;
const COOL_AT = 20;
const COOL_SECS = 15;

/* ════════════════════════ SIGNUP PAGE ════════════════════════ */
function SignupPage({ onBack, onSignupSuccess }) {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");

    if (!studentId || !name || !email || !gender || !pw || !confirmPw) {
      return setErr("All fields are required.");
    }

    if (!/^\d{3}-\d{2}-\d{3}$/.test(studentId)) {
      return setErr("Student ID must follow format: 232-15-001");
    }

    if (!email.includes("@")) {
      return setErr("Please enter a valid email address.");
    }

    if (pw.length < 6) {
      return setErr("Password must be at least 6 characters.");
    }

    if (pw !== confirmPw) {
      return setErr("Passwords do not match.");
    }

    setLoading(true);

    // Create new user
    const newUser = {
      id: studentId,
      name,
      email,
      gender,
      password: pw,
      created_at: new Date().toISOString()
    };

    const success = await DB.upsertUser(newUser);

    if (success) {
      sessionStorage.setItem("user", JSON.stringify(newUser));
      setLoading(false);
      onSignupSuccess(newUser);
    } else {
      setErr("Failed to create account. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: "var(--bg)" }}>
      <div className="auth-box fade">
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, marginBottom: 16 }}>← Back to login</button>
          <div style={{ width: 60, height: 60, background: "linear-gradient(135deg,var(--m400),var(--m300))", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 26, boxShadow: "0 6px 20px rgba(42,184,139,0.3)" }}>🎭</div>
          <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: "var(--text)" }}>Create Account</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>Join FaceRate BD today</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {err && <p className="err-box" style={{ marginBottom: 20 }}>{err}</p>}

          {[
            { lbl: "Student ID", ph: "232-15-001", k: "studentId", val: studentId, onChange: setStudentId, type: "text" },
            { lbl: "Full Name", ph: "Your Name", k: "name", val: name, onChange: setName, type: "text" },
            { lbl: "Email Address", ph: "your@email.com", k: "email", val: email, onChange: setEmail, type: "email" },
          ].map(f => (
            <div key={f.k} style={{ marginBottom: 14 }}>
              <label className="lbl">{f.lbl}</label>
              <input className="inp" type={f.type} placeholder={f.ph} value={f.val}
                onChange={e => f.onChange(e.target.value)} />
            </div>
          ))}

          <div style={{ marginBottom: 26 }}>
            <label className="lbl">Gender</label>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { val: "Male", label: "👨 Male" },
                { val: "Female", label: "👩 Female" },
              ].map(g => (
                <button
                  key={g.val}
                  type="button"
                  onClick={() => setGender(g.val)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: gender === g.val ? "2px solid var(--m400)" : "2px solid var(--border)",
                    background: gender === g.val ? "rgba(42,184,139,0.1)" : "transparent",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 600,
                    color: gender === g.val ? "var(--m400)" : "var(--muted)",
                    transition: "all 0.3s ease",
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {[
            { lbl: "Password", ph: "••••••••", k: "pw", val: pw, onChange: setPw, type: "password" },
            { lbl: "Confirm Password", ph: "••••••••", k: "confirmPw", val: confirmPw, onChange: setConfirmPw, type: "password" },
          ].map(f => (
            <div key={f.k} style={{ marginBottom: 14 }}>
              <label className="lbl">{f.lbl}</label>
              <input className="inp" type={f.type} placeholder={f.ph} value={f.val}
                onChange={e => f.onChange(e.target.value)} />
            </div>
          ))}

          <button className="btn btn-p" style={{ width: "100%", padding: "14px" }} onClick={submit} disabled={loading}>
            {loading ? "Creating Account…" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}



/* ═══════════════════════════════ TERMS & CONDITIONS PAGE ══════════════════════════════════════ */
function TermsAndConditionsPage({ onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar onBack={onBack} />
      <div className="page" style={{ maxWidth: 800, paddingTop: 40 }}>
        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 36, marginBottom: 10 }}>Terms & Conditions</h1>
        <p style={{ color: "var(--muted)", marginBottom: 30 }}>Last updated: April 14, 2026</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>1. Overview</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              FaceRate BD is a platform for evaluating and rating Bangladeshi celebrities. By using this website, you agree to comply with these terms and conditions.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>2. User Accounts</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              Users must be students with a valid student ID. You are responsible for maintaining the confidentiality of your account and password. You agree not to share your account credentials with anyone.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>3. Rating System</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              Ratings are on a scale of 1-10. Users must rate at least 500 photos. Your ratings should be honest and based on your genuine evaluation. Ratings are used for research purposes.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>4. Content Usage</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              All photos used in this platform are for educational and research purposes. You agree to use the platform only for legitimate rating activities and not for any unauthorized purposes.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>5. Data Privacy</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              We store your student ID, name, email, and ratings securely. Your data is used only for research and analytical purposes and will not be shared with third parties without consent.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>6. Prohibited Activities</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              Users must not:
            </p>
            <ul style={{ color: "var(--text)", lineHeight: 1.7, marginLeft: 24, marginBottom: 8 }}>
              <li>Share credentials with other users</li>
              <li>Rate in bad faith or with discriminatory intent</li>
              <li>Attempt to manipulate or hack the system</li>
              <li>Use multiple accounts</li>
              <li>Rate the same photograph multiple times</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>7. Disclaimer</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              FaceRate BD is provided "as is" without warranties. We are not responsible for any damages or issues arising from the use of this platform. The ratings and data are for research purposes only.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>8. Termination</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              We reserve the right to terminate user accounts that violate these terms or engage in prohibited activities. Terminated users may not create new accounts.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>9. Changes to Terms</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              We may update these terms at any time. Continued use of the platform after changes indicates your acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--m500)" }}>10. Contact & Support</h2>
            <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 8 }}>
              For questions about these terms or the platform, please contact us through the GitHub repository:
              <a href="https://github.com/if-i-shajan" target="_blank" rel="noopener noreferrer" style={{ color: "var(--m400)", textDecoration: "none", fontWeight: 600, marginLeft: 6 }}>
                github.com/if-i-shajan →
              </a>
            </p>
          </section>
        </div>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-p" onClick={onBack} style={{ width: "100%" }}>
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ STYLES ══════════════════════════════════════ */
function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=DM+Serif+Display:ital@0;1&family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      :root {
        --m50:#eef9f3; --m100:#def3e7; --m200:#c7e8d6; --m300:#97d7b7;
        --m400:#63c59e; --m500:#359971; --m600:#1f7155;
        --bg:#FFDEAD; --card:#ffffff; --border:#e4ddd2;
        --text:#173c31; --mid:#3f6d5d; --muted:#6d9083;
        --err:#dc5b5b; --r:20px; --rs:14px;
        --sh:0 18px 45px rgba(53,153,113,0.11);
        --sh-lg:0 28px 70px rgba(53,153,113,0.16);
      }
      body { background:var(--bg); font-family:'Plus Jakarta Sans',sans-serif; color:var(--text); }
      input,textarea,select,button { font-family:inherit; }

      .fade { animation:fadeIn 0.38s ease both; }
      @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      @keyframes spin { to{transform:rotate(360deg)} }
      @keyframes popIn { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
      @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes floatIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
      @keyframes shimmer { 0%{background-position:0% center} 100%{background-position:200% center} }
      @keyframes glow { 0%{box-shadow:0 0 0 0 rgba(99,197,158,0.16)} 50%{box-shadow:0 0 0 8px rgba(99,197,158,0.08)} 100%{box-shadow:0 0 0 0 rgba(99,197,158,0.16)} }

      .inp { width:100%;padding:13px 16px;border:2px solid var(--border);border-radius:var(--rs);
             font-size:15px;background:#fff;color:var(--text);transition:all 0.2s ease;box-shadow:0 6px 16px rgba(31,113,85,0.05); }
      .inp:focus { border-color:var(--m400);background:#fff;outline:none;box-shadow:0 0 0 4px rgba(99,197,158,0.12), 0 14px 30px rgba(31,113,85,0.1);animation:glow 1s ease-in-out 1; }
      .inp::placeholder { color:var(--muted); }
      select.inp { cursor:pointer; }

      @keyframes buttonGlow { 0%{box-shadow:0 0 0 0 rgba(99,197,158,0.32)} 70%{box-shadow:0 0 0 16px rgba(99,197,158,0)} 100%{box-shadow:0 0 0 0 rgba(99,197,158,0)} }
      @keyframes buttonPulse { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }
      @keyframes buttonBounce { 0%{transform:translateY(0)} 50%{transform:translateY(-6px)} 100%{transform:translateY(0)} }
      .btn { display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 28px;
             border-radius:100px;font-weight:700;font-size:15px;border:none;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);
             letter-spacing:0.01em;cursor:pointer;font-family:'Poppins',sans-serif;position:relative;overflow:hidden;box-shadow:0 10px 24px rgba(53,153,113,0.16); }
      .btn::before { content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent,rgba(255,255,255,0.34),transparent);
                    transform:translateX(-130%);transition:transform 0.6s ease; }
      .btn:hover::before { transform:translateX(130%); }
      .btn:disabled { opacity:0.55;cursor:not-allowed;transform:none!important; }
      
      .btn-p { background:linear-gradient(135deg,var(--m500),var(--m400));color:#fff;box-shadow:0 14px 28px rgba(53,153,113,0.24); }
      .btn-p:hover:not(:disabled) { transform:translateY(-4px);box-shadow:0 18px 36px rgba(53,153,113,0.28);animation:buttonPulse 0.5s ease; }
      .btn-p:active:not(:disabled) { transform:translateY(-1px);animation:buttonGlow 1.2s ease-out; }
      
      .btn-o { background:#fff;color:var(--m600);border:1.5px solid var(--m200);box-shadow:0 6px 16px rgba(31,113,85,0.06); }
      .btn-o:hover:not(:disabled) { background:#fff;color:var(--m500);transform:translateY(-3px);box-shadow:0 10px 22px rgba(31,113,85,0.1);animation:buttonBounce 0.5s ease; }
      .btn-o:active:not(:disabled) { transform:translateY(0);box-shadow:inset 0 2px 8px rgba(53,153,113,0.14); }
      
      .btn-sm { padding:8px 18px;font-size:13px; }
      
      .btn-danger { background:rgba(255,107,107,0.15);color:var(--err);border:2px solid var(--err);box-shadow:0 4px 12px rgba(255,107,107,0.15); }
      .btn-danger:hover:not(:disabled) { background:rgba(255,107,107,0.25);transform:translateY(-3px);box-shadow:0 6px 16px rgba(255,107,107,0.3); }
      .btn-danger:active:not(:disabled) { transform:translateY(0); }

      .card { background:var(--card);border-radius:var(--r);box-shadow:0 10px 28px rgba(23,60,49,0.06);border:1px solid var(--border);transition:all 0.3s ease; }
      .card-hover { transition:transform 0.2s,box-shadow 0.2s; }
      .card-hover:hover { transform:translateY(-6px);box-shadow:var(--sh-lg); }

      .lbl { font-size:11.5px;font-weight:700;color:var(--mid);margin-bottom:6px;display:block;
             letter-spacing:0.08em;text-transform:uppercase; }
      .err-box { color:var(--err);font-size:13.5px;font-weight:500;padding:11px 15px;background:rgba(255,107,107,0.15);
                 border-radius:10px;border:1px solid var(--err);animation:slideDown 0.3s ease; }
      .ok-box { color:#15803d;font-size:13.5px;font-weight:500;padding:11px 15px;background:rgba(134,239,172,0.14);
                border-radius:10px;border:1px solid #86EFAC;animation:slideDown 0.3s ease; }

      .nav { background:rgba(255,222,173,0.96);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);
             position:sticky;top:0;z-index:100;box-shadow:0 8px 24px rgba(23,60,49,0.04); }
      .nav-i { max-width:1100px;margin:0 auto;padding:0 24px;height:66px;display:flex;align-items:center;justify-content:space-between; }

      .page { max-width:1100px;margin:0 auto;padding:40px 24px; }
      .auth-page { min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg); }
      .auth-box { width:100%;max-width:440px;animation:floatIn 0.6s ease; }

      .rb { width:54px;height:54px;border-radius:14px;border:2px solid var(--border);background:#fff;
            color:var(--mid);font-weight:800;font-size:16px;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);cursor:pointer;font-family:'Poppins',sans-serif;box-shadow:0 6px 16px rgba(31,113,85,0.05); }
      .rb:hover { border-color:var(--m400);background:#fff;color:var(--m500);transform:scale(1.12);box-shadow:0 10px 24px rgba(53,153,113,0.18); }
      .rb.on { border-color:var(--m400);background:linear-gradient(135deg,var(--m500),var(--m400));color:#fff;transform:scale(1.18);box-shadow:0 14px 32px rgba(53,153,113,0.22);animation:buttonBounce 0.5s ease; }

      .prog { height:8px;background:rgba(99,197,158,0.14);border-radius:100px;overflow:hidden;box-shadow:inset 0 2px 6px rgba(31,113,85,0.08); }
      .prog-f { height:100%;background:linear-gradient(90deg,var(--m500),var(--m400));border-radius:100px;transition:width 0.5s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 0 12px rgba(99,197,158,0.22); }

      .photo-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px; }
      .tab-btn { padding:9px 20px;border-radius:100px;font-weight:600;font-size:14px;border:2px solid transparent;
                 cursor:pointer;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);background:#fff;color:var(--muted);box-shadow:0 4px 12px rgba(31,113,85,0.04);border:1.5px solid var(--border); }
      .tab-btn.active { background:linear-gradient(135deg,var(--m500),var(--m400));color:#fff;box-shadow:0 12px 24px rgba(53,153,113,0.22);transform:translateY(-3px);border:none;animation:buttonPulse 0.4s ease; }
      .tab-btn:not(.active):hover { background:#fff;color:var(--m500);transform:translateY(-2px);border-color:var(--m300);box-shadow:0 8px 18px rgba(31,113,85,0.1); }

      .overlay { position:fixed;inset:0;background:rgba(23,60,49,0.22);display:flex;align-items:center;
                 justify-content:center;z-index:999;backdrop-filter:blur(10px);animation:fadeIn 0.3s ease; }

      .divider { display:flex;align-items:center;gap:12;margin:20px 0; }
      .divider::before,.divider::after { content:'';flex:1;height:1px;background:var(--border); }

      @media (max-width:640px) {
        .page{padding:24px 16px}
        .hide-sm{display:none}
        .photo-grid{grid-template-columns:1fr 1fr}
      }
    `}</style>
  );
}

/* ═══════════════════════════════ APP ROOT ════════════════════════════════════ */
export default function App() {
  const [page, setPage] = useState("loading");
  const [user, setUser] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    // Check if user is already logged in (from session storage)
    const session = sessionStorage.getItem("user");
    if (session) {
      setUser(JSON.parse(session));
      setPage("dashboard");
    } else {
      setPage("login");
    }
  }, []);

  const go = (p) => { setErr(""); setPage(p); };

  const doLogin = async (id, pw) => {
    const user = await DB.getUser(id);
    if (!user) return setErr("No account found with this ID.");
    if (user.password !== pw) return setErr("Incorrect password.");

    // Save to session
    sessionStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    go("dashboard");
  };

  const doLogout = async () => {
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("pendingProfile");
    setUser(null);
    go("login");
  };

  const handleSignupSuccess = (user) => {
    sessionStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    go("dashboard");
  };

  if (page === "loading") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F2FCF8" }}>
      <div style={{ width: 44, height: 44, border: "4px solid #D0F5E6", borderTop: "4px solid #2AB88B", borderRadius: "50%", animation: "spin 0.85s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text)" }}>
      <Styles />
      {page === "login" && <LoginPage onLogin={doLogin} onSignup={() => go("signup")} onAdmin={() => go("admin-login")} onTerms={() => go("terms")} err={err} />}
      {page === "signup" && <SignupPage onBack={() => go("login")} onSignupSuccess={handleSignupSuccess} />}
      {page === "terms" && <TermsAndConditionsPage onBack={() => go("login")} />}
      {page === "admin-login" && <AdminLoginPage onBack={() => go("login")} onOk={() => go("admin")} />}
      {page === "dashboard" && <DashboardPage user={user} onLogout={doLogout} onRate={() => go("rating")} onResults={() => go("my-ratings")} />}
      {page === "rating" && <RatingPage user={user} onDone={() => go("dashboard")} />}
      {page === "my-ratings" && <MyRatingsPage user={user} onBack={() => go("dashboard")} />}
      {page === "admin" && <AdminPage onBack={() => go("login")} />}
    </div>
  );
}

/* ═══════════════════════════════ NAVBAR ══════════════════════════════════════ */
function Navbar({ user, onLogout, onBack, adminMode }) {
  return (
    <nav className="nav">
      <div className="nav-i">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {onBack && (
            <button className="btn btn-o btn-sm" onClick={onBack}>← Back</button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 24 }}>📸</span>
            <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: "var(--m500)" }}>FaceRate</span>
            <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: "var(--text)" }}>BD</span>
          </div>
          {adminMode && (
            <span style={{ background: "linear-gradient(135deg,var(--m500),var(--m400))", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 100, letterSpacing: "0.08em", boxShadow: "0 8px 18px rgba(53,153,113,0.2)" }}>ADMIN</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && <span className="hide-sm" style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{user.id}</span>}
          {user && onLogout && <button className="btn btn-o btn-sm" onClick={onLogout}>Sign Out</button>}
          {user && (
            <a href="https://github.com/if-i-shajan" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
              }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "scale(1.1)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
                }}>
                <img
                  src="https://res.cloudinary.com/dsaouglyh/image/upload/q_auto/f_auto/v1776110307/GitHub_Invertocat_Black_Clearspace_fcixrl.png"
                  alt="GitHub"
                  style={{
                    width: 28,
                    height: 28,
                    cursor: "pointer",
                    filter: "invert(1)"
                  }}
                />
              </div>
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ═════════════════════════════════ LOGIN ══════════════════════════════════════ */
function LoginPage({ onLogin, onSignup, onAdmin, onTerms, err }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!id || !pw) return;
    setLoading(true);
    await onLogin(id, pw);
    setLoading(false);
  };

  return (
    <div className="auth-page" style={{ background: "var(--bg)", position: "relative" }}>
      <div className="auth-box fade">
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 68, height: 68, background: "linear-gradient(135deg,var(--m400),var(--m300))", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", fontSize: 32, boxShadow: "0 8px 24px rgba(42,184,139,0.35)" }}>📸</div>
          <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 34, color: "var(--text)", lineHeight: 1.2 }}>FaceRate BD</h1>
          <p style={{ color: "var(--muted)", marginTop: 8, fontSize: 14, fontWeight: 500 }}>Bangladeshi Celebrity Evaluation System</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 24, color: "var(--text)" }}>Welcome back</h2>
          {err && <p className="err-box" style={{ marginBottom: 20 }}>{err}</p>}
          <div style={{ marginBottom: 16 }}>
            <label className="lbl">Student ID</label>
            <input className="inp" placeholder="232-15-001" value={id} onChange={e => setId(e.target.value)} />
          </div>
          <div style={{ marginBottom: 26 }}>
            <label className="lbl">Password</label>
            <input className="inp" type="password" placeholder="••••••••" value={pw}
              onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          <button className="btn btn-p" style={{ width: "100%", padding: "14px" }} onClick={submit} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} /><span style={{ color: "var(--muted)", fontSize: 13 }}>or</span><div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <button className="btn btn-o" style={{ width: "100%", padding: "13px" }} onClick={onSignup}>Create Account</button>
        </div>

        <div style={{ textAlign: "center", marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <button className="btn btn-o" style={{ width: "100%", padding: "12px" }} onClick={onAdmin}>
            🔒 Admin Access
          </button>
          <button className="btn btn-o" style={{ width: "100%", padding: "12px" }} onClick={onTerms}>
            📋 Terms & Conditions
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ SIGNUP ══════════════════════════════════════ */
/* ════════════════════════════ ADMIN LOGIN ════════════════════════════════════ */
function AdminLoginPage({ onBack, onOk }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const check = () => {
    if (pw === ADMIN_PASS) onOk();
    else setErr("Incorrect admin password.");
  };

  return (
    <div className="auth-page" style={{ background: "var(--bg)" }}>
      <div className="auth-box fade">
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, marginBottom: 16 }}>← Back</button>
          <div style={{ width: 60, height: 60, background: "linear-gradient(135deg,var(--m500),var(--m400))", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 26, boxShadow: "0 10px 22px rgba(53,153,113,0.22)" }}>🔒</div>
          <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: "var(--text)" }}>Admin Access</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>Restricted to authorized users</p>
        </div>
        <div className="card" style={{ padding: 32 }}>
          {err && <p className="err-box" style={{ marginBottom: 20 }}>{err}</p>}
          <div style={{ marginBottom: 8 }}>
            <label className="lbl">Admin Password</label>
            <input className="inp" type="password" placeholder="Enter admin password" value={pw}
              onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && check()} />
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-p" style={{ width: "100%", padding: "14px" }} onClick={check}>Enter Admin Panel →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ DASHBOARD ═══════════════════════════════════════ */
function DashboardPage({ user, onLogout, onRate, onResults }) {
  const [stats, setStats] = useState({ total: 0, rated: 0, remaining: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const photos = await DB.getPhotos();
      const progress = await DB.getProgress(user.id);
      const total = Object.keys(photos).length;
      const rated = progress.ratedIds.length;
      setStats({ total, rated, remaining: total - rated });
      setLoading(false);
    })();
  }, [user]);

  const pct = stats.total ? Math.round(stats.rated / stats.total * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar user={user} onLogout={onLogout} />
      <div className="page fade">

        {/* Welcome */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 38, lineHeight: 1.2 }}>
            Hello, <span style={{ color: "var(--m500)" }}>{user.name || user.id}</span> 👋
          </h1>
          <p style={{ color: "var(--mid)", marginTop: 8, fontSize: 15 }}>
            {user.gender === "male" ? "👨" : "👩"} {user.gender?.charAt(0).toUpperCase() + user.gender?.slice(1)} Student &nbsp;·&nbsp; {user.email}
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 32 }}>
          {loading ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 30, color: "var(--muted)" }}>Loading…</div>
          ) : [
            { label: "Total Photos", value: stats.total, icon: "📸", color: "var(--m400)" },
            { label: "Rated by You", value: stats.rated, icon: "✅", color: "#16a34a" },
            { label: "Remaining", value: stats.remaining, icon: "⏳", color: "#d97706" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "22px 24px" }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 5, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Action cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20, marginBottom: 24 }}>
          <div className="card card-hover" style={{ padding: 32, background: "#ffffff", cursor: "pointer" }} onClick={onRate}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🎯</div>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>Start Rating</h3>
            <p style={{ color: "var(--mid)", fontSize: 14, lineHeight: 1.65, marginBottom: 22 }}>
              Rate Bangladeshi celebrity photos on a 1–10 scale. Up to {SESS_MAX} photos per session.
            </p>
            <button className="btn btn-p" onClick={e => { e.stopPropagation(); onRate(); }}>Rate Photos →</button>
          </div>

          <div className="card card-hover" style={{ padding: 32, background: "#ffffff", cursor: "pointer" }} onClick={onResults}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📊</div>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>My Ratings</h3>
            <p style={{ color: "var(--mid)", fontSize: 14, lineHeight: 1.65, marginBottom: 22 }}>
              View all photos you've rated, your scores, and the average rating from all participants.
            </p>
            <button className="btn btn-o" onClick={e => { e.stopPropagation(); onResults(); }}>View Results →</button>
          </div>
        </div>

        {/* Progress bar */}
        {!loading && stats.total > 0 && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Overall Progress</span>
              <span style={{ color: "var(--m500)", fontWeight: 700 }}>{stats.rated} / {stats.total} photos · {pct}%</span>
            </div>
            <div className="prog"><div className="prog-f" style={{ width: `${pct}%` }} /></div>
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
              {stats.remaining > 0 ? `${stats.remaining} photos still to rate` : "🎉 You've rated all available photos!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ RATING PAGE ═════════════════════════════════════ */
function RatingPage({ user, onDone }) {
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sessionCount, setSC] = useState(0);
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cooldown, setCooldown] = useState(false);
  const [cdSecs, setCdSecs] = useState(COOL_SECS);
  const [done, setDone] = useState(false);
  const [doneReason, setDoneReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [imgErr, setImgErr] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const photos = await DB.getPhotos();
        const progress = await DB.getProgress(user.id);
        const allPhotos = Object.values(photos);
        const photoMap = Object.fromEntries(allPhotos.map(photo => [photo.id, photo]));
        const ratedIds = Array.isArray(progress.ratedIds) ? progress.ratedIds : [];
        const ratedSet = new Set(ratedIds);
        const unrated = allPhotos.filter(photo => !ratedSet.has(photo.id));

        if (!unrated.length) {
          if (cancelled) return;
          setDone(true);
          setDoneReason("all");
          setLoading(false);
          return;
        }

        const unratedIds = new Set(unrated.map(photo => photo.id));
        const savedQueueIds = Array.isArray(progress.sessionQueue)
          ? progress.sessionQueue
            .map(item => typeof item === "string" ? item : item?.id)
            .filter(id => id && unratedIds.has(id))
          : [];

        let sessionIdx = Number.isInteger(progress.sessionIdx) ? progress.sessionIdx : 0;
        let queueIds = savedQueueIds;

        if (!queueIds.length || sessionIdx < 0 || sessionIdx >= queueIds.length) {
          queueIds = strongShuffle(unrated).map(photo => photo.id);
          sessionIdx = 0;
          await DB.updateProgress(user.id, {
            ratedIds,
            sessionQueue: queueIds,
            sessionIdx
          });
        }

        const nextQueue = queueIds.map(id => photoMap[id]).filter(Boolean);
        if (!nextQueue.length) {
          if (cancelled) return;
          setDone(true);
          setDoneReason("all");
          setLoading(false);
          return;
        }

        if (cancelled) return;
        setQueue(nextQueue);
        setIdx(sessionIdx);
        setSC(sessionIdx);
      } catch (e) {
        console.error("Failed to load rating session:", e);
        if (cancelled) return;
        setSubmitErr("Could not load your rating session. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const startCooldown = () => {
    setCooldown(true);
    setCdSecs(COOL_SECS);
    let s = COOL_SECS;
    timerRef.current = setInterval(() => {
      s--;
      setCdSecs(s);
      if (s <= 0) { clearInterval(timerRef.current); setCooldown(false); }
    }, 1000);
  };

  const submit = async () => {
    if (!rating) return;
    if (!user || !user.id) {
      setSubmitErr("User session lost. Please log in again.");
      return;
    }

    setSubmitting(true);
    setSubmitErr("");
    const photo = queue[idx];
    if (!photo || !photo.id) {
      setSubmitting(false);
      setSubmitErr("No photo loaded. Try going back and starting again.");
      return;
    }

    try {
      const { ok, error: saveMsg } = await DB.addRating({
        photo_id: photo.id,
        user_id: user.id,
        rating: parseInt(rating)
      });

      if (!ok) {
        setSubmitErr(saveMsg || "Could not save your rating. Check your connection or Supabase row-level security (ratings insert/update).");
        setSubmitting(false);
        return;
      }

      // Get fresh progress from DB
      const progress = await DB.getProgress(user.id);
      const ratedIds = Array.isArray(progress.ratedIds) ? progress.ratedIds : [];

      if (!ratedIds.includes(photo.id)) {
        ratedIds.push(photo.id);
      }

      const newSC = sessionCount + 1;
      const nextIdx = idx + 1;

      const updateSuccess = await DB.updateProgress(user.id, {
        ratedIds,
        sessionQueue: progress.sessionQueue,
        sessionIdx: nextIdx
      });

      if (!updateSuccess) {
        console.error("Warning: Failed to update progress - resume may be affected");
      }

      setSC(newSC);
      setRating(0);
      setImgErr(false);

      // Check if session is complete
      if (nextIdx >= queue.length) {
        // Check if all photos are now rated
        const photos = await DB.getPhotos();
        const allPhotoIds = Object.keys(photos);
        const allRated = allPhotoIds.every(id => ratedIds.includes(id));

        setDone(true);
        setDoneReason(allRated ? "all" : "completed");
        return;
      }

      setIdx(nextIdx);
      if (newSC > 0 && newSC % COOL_AT === 0) {
        startCooldown();
      }
    } catch (e) {
      console.error("Submit error:", e);
      setSubmitErr(e?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
      <div style={{ width: 42, height: 42, border: "4px solid var(--m100)", borderTop: "4px solid var(--m400)", borderRadius: "50%", animation: "spin 0.85s linear infinite" }} />
    </div>
  );

  if (done) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card fade" style={{ padding: 52, textAlign: "center", maxWidth: 440 }}>
        <div style={{ fontSize: 72, marginBottom: 16, animation: "popIn 0.5s ease" }}>
          {doneReason === "all" ? "⏸️" : "🎉"}
        </div>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 30, marginBottom: 12 }}>
          {doneReason === "all" ? "Take a Break!" : "All 500 Photos Rated!"}
        </h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.75, marginBottom: 28 }}>
          {doneReason === "all"
            ? `Great work! You've rated ${sessionCount} photos so far. Come back anytime to continue with the remaining images!`
            : `Excellent! You've completed all 500 photos. Thank you for your contributions to our research!`}
        </p>
        <button className="btn btn-p" style={{ width: "100%" }} onClick={onDone}>← Back to Dashboard</button>
      </div>
    </div>
  );

  const photo = queue[idx];
  if (!photo) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card fade" style={{ padding: 36, textAlign: "center", maxWidth: 460 }}>
          <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, marginBottom: 12 }}>Session needs a refresh</h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.7, marginBottom: 20 }}>
            Your saved rating queue no longer matches the available photos. Go back to the dashboard and start again.
          </p>
          {submitErr && <p className="err-box" style={{ marginBottom: 16 }}>{submitErr}</p>}
          <button className="btn btn-p" onClick={onDone}>Back to Dashboard</button>
        </div>
      </div>
    );
  }
  const progress = Math.round((sessionCount / queue.length) * 100);
  const remaining = COOL_AT - (sessionCount % COOL_AT);
  const ratingLabel = rating <= 3 ? "Poor" : rating <= 5 ? "Fair" : rating <= 7 ? "Good" : rating <= 9 ? "Great" : "Excellent";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar onBack={onDone} />

      {/* ── Cooldown Overlay ── */}
      {cooldown && (
        <div className="overlay">
          <div className="card" style={{ padding: 44, textAlign: "center", maxWidth: 340, animation: "popIn 0.35s ease" }}>
            <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 20px" }}>
              <svg width={120} height={120} style={{ position: "absolute", inset: 0 }}>
                <circle cx={60} cy={60} r={50} fill="none" stroke="var(--m100)" strokeWidth={9} />
                <circle cx={60} cy={60} r={50} fill="none" stroke="var(--m400)" strokeWidth={9}
                  strokeDasharray={314}
                  strokeDashoffset={314 - (314 * cdSecs / COOL_SECS)}
                  strokeLinecap="round" transform="rotate(-90 60 60)"
                  style={{ transition: "stroke-dashoffset 1s linear" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Serif Display',serif", fontSize: 38, color: "var(--text)" }}>{cdSecs}</div>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Take Rest 🧘‍♀️</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.65 }}>
              Make your mind fresh.<br />
              You've rated {sessionCount} photos so far.
            </p>
          </div>
        </div>
      )}

      <div className="page" style={{ maxWidth: 820 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Rating Session</p>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>Photo {sessionCount + 1} of {queue.length}</h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Next break in</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--m500)" }}>{remaining}<span style={{ fontSize: 13, fontWeight: 400 }}> photos</span></div>
          </div>
        </div>

        {/* Progress */}
        <div className="prog" style={{ marginBottom: 30 }}>
          <div className="prog-f" style={{ width: `${progress}%` }} />
        </div>

        {/* Photo Card */}
        <div className="card fade" style={{ overflow: "hidden", boxShadow: "0 15px 50px rgba(26,158,119,0.15)" }}>
          {/* Image */}
          <div style={{ height: "min(52vh, 480px)", minHeight: 280, background: "linear-gradient(135deg,var(--m100),var(--m200))", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!imgErr ? (
              <img src={photo.url} alt={photo.celebrity}
                style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                onError={() => setImgErr(true)} />
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 72, marginBottom: 12 }}>👤</div>
                <p style={{ color: "var(--m600)", fontWeight: 600, fontSize: 16 }}>{photo.celebrity}</p>
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Image unavailable</p>
              </div>
            )}
            {/* Badge with enhanced styling */}
            <div style={{ position: "absolute", bottom: 20, left: 20, background: "rgba(255,255,255,0.84)", backdropFilter: "blur(12px)", color: "var(--text)", padding: "12px 20px", borderRadius: 12, fontSize: 15, fontWeight: 700, letterSpacing: "0.02em", boxShadow: "0 12px 28px rgba(23,60,49,0.12)", border: "1px solid rgba(255,255,255,0.72)" }}>
              🎬 {photo.celebrity}
            </div>
          </div>

          {/* Rating UI */}
          <div style={{ padding: 36, background: "#ffffff" }}>
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: "var(--text)", fontFamily: "'Poppins',sans-serif" }}>Rate this photo</p>
              <p style={{ color: "var(--muted)", fontSize: 14, fontWeight: 500 }}>1 = Very poor &nbsp;·&nbsp; 5 = Average &nbsp;·&nbsp; 10 = Excellent</p>
            </div>

            {/* 1-10 buttons with better spacing */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(58px, 1fr))", gap: 12, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button type="button" key={n} className={`rb${rating === n ? " on" : ""}`} onClick={() => setRating(n)} style={{ fontSize: 16 }}>{n}</button>
              ))}
            </div>

            {/* Rating badge with animation */}
            {rating > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "#ffffff", border: "2px solid var(--m200)", borderRadius: 16, padding: "14px 22px", marginBottom: 28, animation: "popIn 0.4s ease", boxShadow: "0 8px 22px rgba(53,153,113,0.08)" }}>
                <span style={{ fontWeight: 900, color: "var(--m500)", fontSize: 32, fontFamily: "'Poppins',sans-serif" }}>{rating}<span style={{ fontSize: 16, fontWeight: 600, color: "var(--muted)" }}>/10</span></span>
                <span style={{ background: "linear-gradient(135deg,var(--m400),var(--m300))", color: "#fff", borderRadius: 12, padding: "6px 14px", fontSize: 13, fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}>{ratingLabel}</span>
              </div>
            )}

            {submitErr && <p className="err-box" style={{ marginBottom: 16 }}>{submitErr}</p>}

            <button type="button" className="btn btn-p" style={{ width: "100%", padding: "18px 24px", fontSize: 16, fontFamily: "'Poppins',sans-serif" }}
              onClick={submit} disabled={!rating || submitting}>
              {submitting ? "⏳ Saving…" : rating ? `✓ Submit Rating (${rating}/10)` : "Please select a rating above"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════ MY RATINGS PAGE ══════════════════════════════════ */
function MyRatingsPage({ user, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avgTotal, setAvgTotal] = useState(null);

  useEffect(() => {
    (async () => {
      const photos = await DB.getPhotos();
      const ratings = await DB.getRatings();
      const progress = await DB.getProgress(user.id);

      const list = progress.ratedIds.map(id => {
        const photo = photos[id]; if (!photo) return null;
        const pr = ratings[id] || {};
        const myR = pr[user.id];
        const vals = Object.values(pr).map(r => r.rating);
        const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
        return { ...photo, myRating: myR?.rating, myComment: myR?.comment, avg, raterCount: vals.length };
      }).filter(Boolean);

      if (list.length) {
        const myAvg = (list.reduce((a, b) => a + (b.myRating || 0), 0) / list.length).toFixed(1);
        setAvgTotal(myAvg);
      }
      setItems(list);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar onBack={onBack} user={user} />
      <div className="page fade">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 34 }}>My Ratings</h1>
          <p style={{ color: "var(--muted)", marginTop: 6, fontSize: 14 }}>
            {items.length} photos rated
            {avgTotal && ` · Your average score: `}
            {avgTotal && <strong style={{ color: "var(--m500)" }}>{avgTotal}/10</strong>}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>Loading your ratings…</div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 72, textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No ratings yet</h3>
            <p style={{ color: "var(--muted)" }}>Head to the rating session to start evaluating photos.</p>
          </div>
        ) : (
          <div className="photo-grid">
            {items.map(item => <RatedCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function RatedCard({ item }) {
  const [imgErr, setImgErr] = useState(false);
  const col = item.myRating >= 8 ? "#16a34a" : item.myRating >= 5 ? "#d97706" : "#dc2626";
  const stars = "★".repeat(Math.round(item.myRating / 2)) + "☆".repeat(5 - Math.round(item.myRating / 2));

  return (
    <div className="card card-hover" style={{ overflow: "hidden" }}>
      <div style={{ height: 260, minHeight: 220, background: "linear-gradient(135deg,var(--m100),var(--m200))", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {!imgErr ? (
          <img src={item.url} alt={item.celebrity}
            style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
            onError={() => setImgErr(true)} />
        ) : (
          <div style={{ textAlign: "center", color: "var(--m600)" }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>👤</div>
            <p style={{ fontSize: 12, fontWeight: 600 }}>{item.celebrity}</p>
          </div>
        )}
        {/* Rating pill on image */}
        <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.84)", backdropFilter: "blur(6px)", color: "var(--text)", padding: "5px 12px", borderRadius: 100, fontWeight: 800, fontSize: 15, border: "1px solid rgba(255,255,255,0.72)", boxShadow: "0 8px 20px rgba(23,60,49,0.1)" }}>
          {item.myRating}/10
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <p style={{ fontWeight: 700, fontSize: 15 }}>{item.celebrity}</p>
        <p style={{ color: "var(--muted)", fontSize: 11, textTransform: "capitalize", marginBottom: 10 }}>{item.gender}</p>

        {/* Stars */}
        <div style={{ fontSize: 14, color: "#f59e0b", marginBottom: 12, letterSpacing: 2 }}>{stars}</div>

        <div style={{ display: "flex", gap: 12 }}>
          {/* My rating */}
          <div style={{ flex: 1, background: "var(--m50)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Your Rating</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: col, lineHeight: 1 }}>{item.myRating}<span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>/10</span></p>
          </div>
          {/* Average */}
          <div style={{ flex: 1, background: "linear-gradient(135deg,#f7fdf9,var(--m50))", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "var(--m500)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Avg Rating</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "var(--m600)", lineHeight: 1 }}>{item.avg ?? "—"}<span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>/10</span></p>
            <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{item.raterCount} rater{item.raterCount !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {item.myComment && (
          <div style={{ marginTop: 12, padding: "9px 12px", background: "var(--m50)", borderRadius: 9, fontSize: 12, color: "var(--mid)", borderLeft: "3px solid var(--m300)", lineHeight: 1.55 }}>
            "{item.myComment}"
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════ TOAST NOTIFICATIONS ══════════════════════════════════ */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed",
      top: 20,
      right: 20,
      background: type === "ok" ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#EF4444,#DC2626)",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      zIndex: 1000,
      animation: "slideInRight 0.3s ease",
      maxWidth: 400,
      display: "flex",
      alignItems: "center",
      gap: 12
    }}>
      <span style={{ fontSize: 18 }}>{type === "ok" ? "✅" : "❌"}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, opacity: 0.8 }}>×</button>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}
/* ════════════════════ COMPREHENSIVE ANALYTICS ════════════════════ */
function AnalyticsPage({ ratings, users, photos }) {
  // Calculate overall rating statistics
  let totalRatings = 0;
  let ratingSum = 0;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };

  Object.values(ratings).forEach(photoRatings => {
    Object.values(photoRatings).forEach(ratingData => {
      totalRatings++;
      ratingSum += ratingData.rating;
      ratingDistribution[ratingData.rating]++;
    });
  });

  const overallAverage = totalRatings ? (ratingSum / totalRatings).toFixed(2) : 0;
  const maxDistribution = Math.max(...Object.values(ratingDistribution));

  // Gender Analysis
  const maleUsers = Object.values(users).filter(u => u.gender === "male").length;
  const femaleUsers = Object.values(users).filter(u => u.gender === "female").length;

  let maleRatings = 0, femaleRatings = 0, maleRatingSum = 0, femaleRatingSum = 0;

  Object.values(ratings).forEach(photoRatings => {
    Object.entries(photoRatings).forEach(([userId, ratingData]) => {
      const user = users[userId];
      if (!user) return;

      if (user.gender === "male") {
        maleRatings++;
        maleRatingSum += ratingData.rating;
      } else if (user.gender === "female") {
        femaleRatings++;
        femaleRatingSum += ratingData.rating;
      }
    });
  });

  const maleAvg = maleRatings ? (maleRatingSum / maleRatings).toFixed(2) : 0;
  const femaleAvg = femaleRatings ? (femaleRatingSum / femaleRatings).toFixed(2) : 0;

  // Rating quality breakdown
  const poor = Object.values(ratingDistribution).slice(0, 3).reduce((a, b) => a + b, 0);
  const fair = Object.values(ratingDistribution).slice(3, 6).reduce((a, b) => a + b, 0);
  const good = Object.values(ratingDistribution).slice(6, 9).reduce((a, b) => a + b, 0);
  const excellent = ratingDistribution[10];

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 32, marginBottom: 8 }}>Rating Analytics Dashboard</h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Comprehensive insights into all ratings and user behavior</p>
      </div>

      {/* Top Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, #E0F7F4, #B3E5FC)", borderRadius: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Total Ratings</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#0284c7" }}>{totalRatings}</div>
          <div style={{ fontSize: 12, color: "#0369a1", marginTop: 2 }}>across all photos</div>
        </div>

        <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, #FFF7ED, #FED7AA)", borderRadius: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⭐</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Average Rating</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#b45309" }}>{overallAverage}<span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}>/10</span></div>
          <div style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>overall score</div>
        </div>

        <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", borderRadius: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Photos Rated</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#16a34a" }}>{Object.keys(ratings).length}</div>
          <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>out of {Object.keys(photos).length}</div>
        </div>

        <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, #FCE7F3, #FBD1DE)", borderRadius: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Active Raters</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#db2777" }}>{Object.keys(users).length}</div>
          <div style={{ fontSize: 12, color: "#be185d", marginTop: 2 }}>registered users</div>
        </div>
      </div>

      {/* Rating Distribution Bar Chart */}
      <div className="card" style={{ padding: 32, marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 28, color: "var(--text)" }}>Rating Distribution (1-10)</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(60px, 1fr))", gap: 12 }}>
          {Object.entries(ratingDistribution).map(([rating, count]) => (
            <div key={rating} style={{ textAlign: "center" }}>
              <div style={{ marginBottom: 8, height: 120, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{
                  width: "100%",
                  height: maxDistribution ? `${(count / maxDistribution) * 100}%` : 0,
                  background: `linear-gradient(180deg, ${rating <= 3 ? '#ef4444' :
                    rating <= 5 ? '#f97316' :
                      rating <= 7 ? '#eab308' :
                        rating <= 8 ? '#84cc16' :
                          '#22c55e'
                    }, ${rating <= 3 ? '#dc2626' :
                      rating <= 5 ? '#ea580c' :
                        rating <= 7 ? '#ca8a04' :
                          rating <= 8 ? '#65a30d' :
                            '#16a34a'
                    })`,
                  borderRadius: "8px 8px 0 0",
                  minHeight: "4px",
                  transition: "height 0.6s ease"
                }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{rating}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rating Quality Breakdown */}
      <div className="card" style={{ padding: 32, marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 28, color: "var(--text)" }}>Rating Quality Breakdown</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
          <div style={{ textAlign: "center", padding: 20, background: "#fef2f2", borderRadius: 14, border: "2px solid #fca5a5" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>😞</div>
            <div style={{ fontWeight: 700, fontSize: 24, color: "#dc2626" }}>{poor}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Poor (1-3)</div>
            <div style={{ fontSize: 11, color: "#991b1b", marginTop: 6, fontWeight: 600 }}>{totalRatings ? `${((poor / totalRatings) * 100).toFixed(1)}%` : '0%'}</div>
          </div>

          <div style={{ textAlign: "center", padding: 20, background: "#fef3c7", borderRadius: 14, border: "2px solid #fcd34d" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>😐</div>
            <div style={{ fontWeight: 700, fontSize: 24, color: "#f59e0b" }}>{fair}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Fair (4-6)</div>
            <div style={{ fontSize: 11, color: "#92400e", marginTop: 6, fontWeight: 600 }}>{totalRatings ? `${((fair / totalRatings) * 100).toFixed(1)}%` : '0%'}</div>
          </div>

          <div style={{ textAlign: "center", padding: 20, background: "#dbeafe", borderRadius: 14, border: "2px solid #93c5fd" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>😊</div>
            <div style={{ fontWeight: 700, fontSize: 24, color: "#0284c7" }}>{good}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Good (7-9)</div>
            <div style={{ fontSize: 11, color: "#0369a1", marginTop: 6, fontWeight: 600 }}>{totalRatings ? `${((good / totalRatings) * 100).toFixed(1)}%` : '0%'}</div>
          </div>

          <div style={{ textAlign: "center", padding: 20, background: "#f0fdf4", borderRadius: 14, border: "2px solid #86efac" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🤩</div>
            <div style={{ fontWeight: 700, fontSize: 24, color: "#16a34a" }}>{excellent}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Excellent (10)</div>
            <div style={{ fontSize: 11, color: "#15803d", marginTop: 6, fontWeight: 600 }}>{totalRatings ? `${((excellent / totalRatings) * 100).toFixed(1)}%` : '0%'}</div>
          </div>
        </div>
      </div>

      {/* Gender Analysis Section */}
      <div className="card" style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 28, color: "var(--text)" }}>Gender Comparison Analysis</h2>

        {/* Gender Overview */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
          <div className="card" style={{ padding: 20, background: "linear-gradient(135deg, #E0F7F4, #B3E5FC)" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>👨</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Male Users</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#0284c7" }}>{maleUsers}</div>
          </div>

          <div className="card" style={{ padding: 20, background: "linear-gradient(135deg, #FCE7F3, #FBD1DE)" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>👩</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Female Users</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#db2777" }}>{femaleUsers}</div>
          </div>
        </div>

        {/* Votes Comparison Bars */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--text)" }}>Votes Submitted</h3>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>👨 Male Votes</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#0284c7" }}>{maleRatings} votes</span>
            </div>
            <div style={{ width: "100%", height: 32, background: "var(--m100)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.max(maleRatings, femaleRatings) ? (maleRatings / Math.max(maleRatings, femaleRatings)) * 100 : 0}%`,
                background: "linear-gradient(90deg, #0284c7, #06b6d4)",
                borderRadius: 16,
                transition: "width 0.8s ease"
              }} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>👩 Female Votes</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#db2777" }}>{femaleRatings} votes</span>
            </div>
            <div style={{ width: "100%", height: 32, background: "var(--m100)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.max(maleRatings, femaleRatings) ? (femaleRatings / Math.max(maleRatings, femaleRatings)) * 100 : 0}%`,
                background: "linear-gradient(90deg, #db2777, #ec4899)",
                borderRadius: 16,
                transition: "width 0.8s ease"
              }} />
            </div>
          </div>
        </div>

        {/* Average Rating Comparison */}
        <div style={{ paddingTop: 24, borderTop: "2px solid var(--border)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--text)" }}>Average Rating Comparison</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: "#0284c7" }}>{maleAvg}<span style={{ fontSize: 16, color: "var(--muted)", fontWeight: 400 }}>/10</span></div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, fontWeight: 600 }}>Male Average</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{maleRatings} ratings</div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: "#db2777" }}>{femaleAvg}<span style={{ fontSize: 16, color: "var(--muted)", fontWeight: 400 }}>/10</span></div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, fontWeight: 600 }}>Female Average</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{femaleRatings} ratings</div>
            </div>
          </div>

          {maleRatings > 0 && femaleRatings > 0 && (
            <div style={{ marginTop: 24, padding: 16, background: "linear-gradient(135deg, var(--m50), #E0F9F3)", borderRadius: 14, border: "2px solid var(--m200)" }}>
              <div style={{ fontSize: 13, color: "var(--mid)", fontWeight: 700 }}>💡 Key Insight:</div>
              <div style={{ fontSize: 13, color: "var(--text)", marginTop: 8, lineHeight: 1.6 }}>
                {Math.abs(maleAvg - femaleAvg) < 0.5
                  ? "✅ Male and female voters have nearly identical rating preferences, showing consistent evaluation criteria."
                  : maleAvg > femaleAvg
                    ? `📈 Males tend to rate ${(maleAvg - femaleAvg).toFixed(2)} points higher than females on average.`
                    : `📈 Females tend to rate ${(femaleAvg - maleAvg).toFixed(2)} points higher than males on average.`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ GENDER ANALYTICS CHART ════════════════════ */
function GenderAnalyticsChart({ ratings, users }) {
  const maleUsers = Object.values(users).filter(u => u.gender === "male").length;
  const femaleUsers = Object.values(users).filter(u => u.gender === "female").length;

  let maleRatings = 0, femaleRatings = 0, maleRatingSum = 0, femaleRatingSum = 0;

  Object.values(ratings).forEach(photoRatings => {
    Object.entries(photoRatings).forEach(([userId, ratingData]) => {
      const user = users[userId];
      if (!user) return;

      if (user.gender === "male") {
        maleRatings++;
        maleRatingSum += ratingData.rating;
      } else if (user.gender === "female") {
        femaleRatings++;
        femaleRatingSum += ratingData.rating;
      }
    });
  });

  const maleAvg = maleRatings ? (maleRatingSum / maleRatings).toFixed(2) : 0;
  const femaleAvg = femaleRatings ? (femaleRatingSum / femaleRatings).toFixed(2) : 0;

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "var(--text)" }}>Gender Comparison Analytics</h2>

        {/* Overview Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 40 }}>
          <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, #E0F7F4, #B3E5FC)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👨</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Male Users</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#0284c7" }}>{maleUsers}</div>
            <div style={{ fontSize: 12, color: "#0369a1", marginTop: 4 }}>Total Registered</div>
          </div>

          <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, #FCE7F3, #FBD1DE)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👩</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Female Users</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#db2777" }}>{femaleUsers}</div>
            <div style={{ fontSize: 12, color: "#be185d", marginTop: 4 }}>Total Registered</div>
          </div>

          <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, rgba(42,184,139,0.1), rgba(42,184,139,0.05))" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Total Ratings</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--m500)" }}>{maleRatings + femaleRatings}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>From Both Genders</div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="card" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 28, color: "var(--text)" }}>Votes Comparison</h3>

          <div style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>👨 Male Votes</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: "#0284c7" }}>{maleRatings} votes</span>
              </div>
              <div style={{ width: "100%", height: 28, background: "var(--m100)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.max(maleRatings, femaleRatings) ? (maleRatings / Math.max(maleRatings, femaleRatings)) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #0284c7, #06b6d4)",
                  borderRadius: 14,
                  transition: "width 0.8s ease"
                }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>👩 Female Votes</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: "#db2777" }}>{femaleRatings} votes</span>
              </div>
              <div style={{ width: "100%", height: 28, background: "var(--m100)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.max(maleRatings, femaleRatings) ? (femaleRatings / Math.max(maleRatings, femaleRatings)) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #db2777, #ec4899)",
                  borderRadius: 14,
                  transition: "width 0.8s ease"
                }} />
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div style={{ paddingTop: 28, borderTop: "2px solid var(--border)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: "var(--text)" }}>Average Rating Difference</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>Male Average</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: "#0284c7" }}>{maleAvg}<span style={{ fontSize: 18, color: "var(--muted)", fontWeight: 400 }}>/10</span></div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{maleRatings} ratings from males</div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>Female Average</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: "#db2777" }}>{femaleAvg}<span style={{ fontSize: 18, color: "var(--muted)", fontWeight: 400 }}>/10</span></div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{femaleRatings} ratings from females</div>
              </div>
            </div>

            {maleRatings > 0 && femaleRatings > 0 && (
              <div style={{ marginTop: 24, padding: 16, background: "linear-gradient(135deg, var(--m50), #E0F9F3)", borderRadius: 16, border: "1px solid var(--m200)" }}>
                <div style={{ fontSize: 14, color: "var(--mid)", fontWeight: 600 }}>
                  💡 Insight:
                </div>
                <div style={{ fontSize: 14, color: "var(--text)", marginTop: 6 }}>
                  {Math.abs(maleAvg - femaleAvg) < 0.5
                    ? "Male and female voters have very similar rating preferences."
                    : maleAvg > femaleAvg
                      ? `Males tend to rate slightly higher than females (${(maleAvg - femaleAvg).toFixed(2)} point difference).`
                      : `Females tend to rate slightly higher than males (${(femaleAvg - maleAvg).toFixed(2)} point difference).`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminPage({ onBack }) {
  const [tab, setTab] = useState("add");
  const [celebrity, setCeleb] = useState("");
  const [gender, setGender] = useState("");
  const [urls, setUrls] = useState(Array(5).fill(""));
  const [photos, setPhotos] = useState({});
  const [ratings, setRatings] = useState({});
  const [users, setUsers] = useState({});
  const [userProgress, setUserProgress] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [toast, setToast] = useState(null); // {type, message}
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [nextPhotos, nextRatings, nextUsers] = await Promise.all([
        DB.getPhotos(),
        DB.getRatings(),
        (async () => {
          const users = await DB.getAllUsers();
          const usersMap = {};
          users.forEach(u => { usersMap[u.id] = u; });
          return usersMap;
        })()
      ]);

      if (cancelled) return;

      setPhotos(nextPhotos || {});
      setRatings(nextRatings || {});
      setUsers(nextUsers || {});

      // Load progress for all users
      const progressPromises = Object.keys(nextUsers || {}).map(async (userId) => {
        const prog = await DB.getProgress(userId);
        return [userId, prog.ratedIds.length];
      });
      const progressResults = await Promise.all(progressPromises);
      const progressMap = Object.fromEntries(progressResults);
      setUserProgress(progressMap);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const addPhotos = async () => {
    const valid = urls.filter(u => u.trim());
    if (!celebrity.trim()) return setToast({ type: "err", message: "Celebrity name is required." });
    if (!valid.length) return setToast({ type: "err", message: "Add at least one photo URL." });
    setSaving(true);

    let successCount = 0;
    for (const url of valid) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const photo = {
        id,
        celebrity: celebrity.trim(),
        gender: "unspecified",
        url: url.trim(),
        created_at: new Date().toISOString()
      };
      const success = await DB.addPhoto(photo);
      if (success) {
        setPhotos(prev => ({ ...prev, [id]: photo }));
        successCount++;
      }
    }

    setCeleb(""); setGender(""); setUrls(Array(5).fill(""));
    setToast({ type: "ok", message: `✅ ${successCount} photo(s) added for "${celebrity.trim()}".` });
    setSaving(false);
  };

  const deletePhoto = async (id) => {
    const success = await DB.deletePhoto(id);
    if (success) {
      const p = { ...photos };
      delete p[id];
      setPhotos(p);
      setToast({ type: "ok", message: "✅ Photo deleted successfully." });
    }
  };

  const allPhotos = Object.values(photos);
  const celebrities = [...new Set(allPhotos.map(p => p.celebrity))];
  const userCount = Object.keys(users).length;

  const getStats = (photoId) => {
    const r = ratings[photoId] || {};
    const vals = Object.values(r).map(x => x.rating);
    return { avg: vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null, count: vals.length };
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar onBack={onBack} adminMode />
      <div className="page fade">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 34 }}>Admin Panel</h1>
            <p style={{ color: "var(--muted)", marginTop: 5, fontSize: 14 }}>
              {allPhotos.length} photos &nbsp;·&nbsp; {celebrities.length} celebrities &nbsp;·&nbsp; {userCount} registered users
            </p>
          </div>
          {/* Quick stats */}
          <div style={{ display: "flex", gap: 12 }}>
            {[{ l: "Photos", v: allPhotos.length }, { l: "Celebrities", v: celebrities.length }, { l: "Users", v: userCount }].map(s => (
              <div key={s.l} className="card" style={{ padding: "12px 18px", textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--m500)" }}>{s.v}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28, background: "var(--m50)", borderRadius: 12, padding: 6, width: "fit-content", flexWrap: "wrap" }}>
          {[
            { id: "add", label: "+ Add Photos" },
            { id: "photos", label: "📸 All Photos" },
            { id: "users", label: "👥 Users" },
            { id: "analytics", label: "📊 Analytics" },
            { id: "export", label: "💾 Export Data" },
          ].map(t => (
            <button key={t.id} className={`tab-btn${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ── ANALYTICS TAB ── */}
        {tab === "analytics" && (
          <AnalyticsPage ratings={ratings} users={users} photos={photos} />
        )}

        {/* ── ADD PHOTOS TAB ── */}
        {tab === "add" && (
          <div className="card" style={{ padding: 36, maxWidth: 580 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Add Celebrity Photos</h3>

            <div style={{ marginBottom: 24 }}>
              <label className="lbl">Celebrity Name</label>
              <input className="inp" placeholder="e.g. Shakib Al Hasan" value={celebrity} onChange={e => setCeleb(e.target.value)} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label className="lbl">Photo URLs (add up to 5 photos)</label>
              <div style={{ maxHeight: "300px", overflowY: "auto", paddingRight: 8 }}>
                {urls.map((u, i) => (
                  <div key={i} style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 28, fontWeight: 600, textAlign: "right" }}>#{i + 1}</span>
                    <input className="inp" placeholder={`Paste direct image URL for photo ${i + 1}`}
                      value={u} onChange={e => { const n = [...urls]; n[i] = e.target.value; setUrls(n); }} />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>💡 Images count: {urls.filter(u => u.trim()).length}/5 &nbsp;·&nbsp; Use direct image links (ending in .jpg, .png, etc.)</p>
            </div>

            <button className="btn btn-p" onClick={addPhotos} disabled={saving} style={{ padding: "13px 28px" }}>
              {saving ? "Adding…" : `+ Add Photos for ${celebrity || "Celebrity"}`}
            </button>
          </div>
        )}

        {/* ── ALL PHOTOS TAB ── */}
        {tab === "photos" && (
          <div>
            {/* Search/Filter */}
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <input
                className="inp"
                placeholder="Search celebrities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ maxWidth: 300 }}
              />
              {selectedPhotos.size > 0 && (
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="btn btn-danger btn-sm" onClick={async () => {
                    if (!confirm(`Delete ${selectedPhotos.size} selected photo(s)? This action cannot be undone.`)) return;
                    const remainingPhotos = { ...photos };
                    for (const photoId of selectedPhotos) {
                      await DB.deletePhoto(photoId);
                      delete remainingPhotos[photoId];
                    }
                    setPhotos(remainingPhotos);
                    setSelectedPhotos(new Set());
                    setToast({ type: "ok", message: `✅ Deleted ${selectedPhotos.size} photo(s).` });
                  }}>
                    🗑️ Delete Selected ({selectedPhotos.size})
                  </button>
                  <button className="btn btn-o btn-sm" onClick={() => setSelectedPhotos(new Set())}>
                    Deselect All
                  </button>
                </div>
              )}
            </div>

            {celebrities.length === 0 ? (
              <div className="card" style={{ padding: 72, textAlign: "center" }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>📭</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--muted)" }}>No photos added yet</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>Switch to "Add Photos" to get started.</p>
              </div>
            ) : celebrities
              .filter(celeb => !searchQuery || celeb.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(celeb => {
                const cp = allPhotos.filter(p => p.celebrity === celeb);
                return (
                  <div key={celeb} style={{ marginBottom: 36 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <h3 style={{ fontSize: 19, fontWeight: 700 }}>{celeb}</h3>
                      <span style={{ background: "var(--m100)", color: "var(--m600)", padding: "3px 12px", borderRadius: 100, fontSize: 12, fontWeight: 700 }}>{cp.length} photos</span>
                      <span style={{ background: "rgba(255,255,255,0.8)", color: "var(--mid)", padding: "3px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600, textTransform: "capitalize", border: "1px solid var(--border)" }}>{cp[0]?.gender}</span>
                      <button
                        className="btn btn-o btn-sm"
                        onClick={() => {
                          const celebPhotoIds = cp.map(p => p.id);
                          const allSelected = celebPhotoIds.every(id => selectedPhotos.has(id));
                          const newSelected = new Set(selectedPhotos);
                          if (allSelected) {
                            celebPhotoIds.forEach(id => newSelected.delete(id));
                          } else {
                            celebPhotoIds.forEach(id => newSelected.add(id));
                          }
                          setSelectedPhotos(newSelected);
                        }}
                        style={{ fontSize: 11, padding: "2px 8px" }}
                      >
                        {cp.every(p => selectedPhotos.has(p.id)) ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
                      {cp.map(photo => {
                        const { avg, count } = getStats(photo.id);
                        return <AdminPhotoCard
                          key={photo.id}
                          photo={photo}
                          avg={avg}
                          count={count}
                          onDelete={() => deletePhoto(photo.id)}
                          isSelected={selectedPhotos.has(photo.id)}
                          onToggleSelect={() => {
                            const newSelected = new Set(selectedPhotos);
                            if (newSelected.has(photo.id)) {
                              newSelected.delete(photo.id);
                            } else {
                              newSelected.add(photo.id);
                            }
                            setSelectedPhotos(newSelected);
                          }}
                        />;
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div>
            {userCount === 0 ? (
              <div className="card" style={{ padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>👥</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--muted)" }}>No users registered yet</h3>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gap: 10 }}>
                  {/* Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px", gap: 12, padding: "10px 20px", background: "var(--m50)", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    <span>Student ID</span><span>Email</span><span>Gender</span><span>Rated</span>
                  </div>
                  {Object.values(users).map(u => {
                    const ratedCount = userProgress[u.id] || 0;
                    return (
                      <div key={u.id} className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px", gap: 12, padding: "14px 20px", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "var(--m500)", fontFamily: "monospace", fontSize: 14 }}>{u.id}</span>
                        <span style={{ color: "var(--mid)", fontSize: 14 }}>{u.email}</span>
                        <span style={{ textTransform: "capitalize", fontSize: 14, color: "var(--muted)" }}>{u.gender}</span>
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>{ratedCount}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>Total registered users: <strong>{userCount}</strong></p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EXPORT DATA TAB ── */}
        {tab === "export" && (
          <div className="card" style={{ padding: 36 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Export Rating Data</h3>
            <p style={{ color: "var(--muted)", marginBottom: 28, lineHeight: 1.6 }}>
              Download comprehensive rating data including all user ratings, averages, and statistics in CSV format.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
              <div className="card" style={{ padding: 20, textAlign: "center", background: "#ffffff" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{Object.keys(ratings).length}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Photos with Ratings</div>
              </div>
              <div className="card" style={{ padding: 20, textAlign: "center", background: "#ffffff" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{userCount}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Active Users</div>
              </div>
              <div className="card" style={{ padding: 20, textAlign: "center", background: "#ffffff" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  {Object.values(ratings).reduce((sum, photoRatings) => sum + Object.keys(photoRatings).length, 0)}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Total Ratings</div>
              </div>
            </div>

            <button className="btn btn-p" style={{ width: "100%", padding: "16px" }} onClick={() => {
              // Generate CSV data
              const csvData = [];
              csvData.push(['Photo ID', 'Celebrity', 'Gender', 'User ID', 'Rating', 'Comment', 'Rated At']);

              Object.entries(ratings).forEach(([photoId, photoRatings]) => {
                const photo = photos[photoId];
                if (!photo) return;

                Object.entries(photoRatings).forEach(([userId, ratingData]) => {
                  csvData.push([
                    photoId,
                    photo.celebrity,
                    photo.gender,
                    userId,
                    ratingData.rating,
                    `"${ratingData.comment || ''}"`,
                    new Date(ratingData.ratedAt).toLocaleString()
                  ]);
                });
              });

              const csvContent = csvData.map(row => row.join(',')).join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `facrate-bd-ratings-${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
            }}>
              📥 Download Ratings CSV
            </button>

            <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#991b1b" }}>⚠️ Danger Zone</h4>
              <p style={{ color: "var(--muted)", marginBottom: 16, fontSize: 14 }}>Clear all app data including users, photos, ratings, and sessions. This action cannot be undone.</p>
              <button className="btn btn-danger" style={{ width: "100%", padding: "12px" }} onClick={() => {
                if (confirm("🚨 Are you SURE? This will delete ALL data and reset the app to first-time use.")) {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }
              }}>
                ⚡ Clear All Data & Reset App
              </button>
            </div>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function AdminPhotoCard({ photo, avg, count, onDelete, isSelected, onToggleSelect }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="card" style={{ overflow: "hidden", position: "relative" }}>
      {/* Checkbox */}
      <div style={{ position: "absolute", top: 7, left: 7, zIndex: 10 }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          style={{ width: 18, height: 18, accentColor: "var(--m400)" }}
        />
      </div>
      <div style={{ height: 200, minHeight: 160, background: "linear-gradient(135deg,var(--m100),var(--m200))", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {!imgErr ? (
          <img src={photo.url} alt={photo.celebrity} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} onError={() => setImgErr(true)} />
        ) : (
          <span style={{ fontSize: 36 }}>👤</span>
        )}
        <button onClick={onDelete} style={{ position: "absolute", top: 7, right: 7, background: "rgba(217,58,58,0.88)", border: "none", color: "#fff", width: 26, height: 26, borderRadius: "50%", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>×</button>
      </div>
      <div style={{ padding: "10px 12px" }}>
        {avg ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "var(--m500)" }}>{avg}<span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>/10</span></span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{count} rater{count !== 1 ? "s" : ""}</span>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No ratings yet</p>
        )}
      </div>
    </div>
  );
}
