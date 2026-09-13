import React from "react";

/**
 * Copy for each phase the update checker publishes. The title says what is
 * happening; the detail — when there is one — says which version it is
 * happening to, or what comes next. Tone follows the scan panel: calm and
 * plain, never alarming.
 */
const UPDATE_PHASES = {
  checking: { title: "Checking for updates…" },
  downloading: {
    title: "Downloading update…",
    detail: (s) => s.version && `Diskern ${s.version}`,
  },
  deferred: {
    title: "Will update after the current operation finishes",
    detail: (s) => s.version && `Diskern ${s.version} is downloaded`,
  },
  ready: {
    title: "Update ready to install",
    detail: (s) => s.version && `Diskern ${s.version}`,
  },
  installing: {
    title: "Installing update…",
    detail: "Diskern will restart when it finishes",
  },
  failed: { title: "Update failed — you can keep using Diskern" },
};

/**
 * A small corner toast for the auto-updater. Checking, downloading, waiting
 * on running work, installing and failing each get a quiet line, so the
 * "Restart to update?" dialog never appears out of nowhere and a deferred
 * or failed update never reads as a frozen app.
 *
 * It is status-only, in a fixed corner, so nothing it shows can block or
 * shift the app — the install decision itself still belongs to the confirm
 * dialog. Only a failed update lingers, and it gets a dismiss button;
 * every other phase clears itself when the checker moves on.
 */
export default function UpdateStatus({ status, onDismiss }) {
  if (!status) return null;
  const phase = UPDATE_PHASES[status.phase] ?? { title: String(status.phase) };
  const detail =
    typeof phase.detail === "function" ? phase.detail(status) : phase.detail;

  return (
    <div className={`update-status update-${status.phase}`} role="status">
      {/* Decorative — the text already says what's happening. */}
      <span className="update-dot" aria-hidden="true" />
      <div className="update-copy">
        <p className="update-title">{phase.title}</p>
        {detail && <p className="update-detail">{detail}</p>}
      </div>
      {status.phase === "failed" && (
        <button className="update-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
