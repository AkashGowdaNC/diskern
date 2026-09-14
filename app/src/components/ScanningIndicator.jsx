import React from "react";
import BrandMark from "../BrandMark.jsx";
import { humanBytes } from "../format.js";

/**
 * Live "is this actually working" feedback while a scan runs, dressed as
 * a small branded panel rather than a bare bar.
 *
 * There's no true percentage to show — the total file count on disk isn't
 * known until the walk finishes, so faking a 0-100% number would just be
 * lying with more decimals. Instead: a real, continuously-updating count
 * of files found so far (proof of life) plus an animated indeterminate
 * bar (motion reads as "working," not "frozen").
 *
 * The panel around it carries the reassurance the scan deserves: a
 * shield mark (the walk is read-only, so the icon says "safe", not
 * "fast") and copy that says plainly nothing is being changed. When the
 * user cancels, the panel doesn't snap away — `cancelling` freezes the
 * motion and dims the panel while the walk finishes the entry it's on.
 */
export default function ScanningIndicator({ filesSeen, bytesSeen, phase, onCancel, cancelling }) {
  return (
    <div className={`scan-progress${cancelling ? " cancelling" : ""}`}>
      <div className="scan-head">
        {/* Decorative — the status text already says the scan is safe. */}
        <BrandMark className="scan-mark" />
        <div className="scan-copy">
          <p className="scan-status">
            {cancelling
              ? "Stopping the scan… nothing has been changed"
              : "Scanning safely… nothing is being changed"}
          </p>
          <p className="progress-phase">{phase || "Walking files"}</p>
          <p className="progress-count">
            {filesSeen.toLocaleString()} files found
            {bytesSeen > 0 && <> · {humanBytes(bytesSeen)} so far</>}
          </p>
        </div>
      </div>
      <div className="progress-track">
        <div className="progress-fill-indeterminate" />
      </div>
      {/* The walk checks the cancel flag per entry, so stopping is quick but
          not instant — say "Stopping…" rather than pretending it's done. */}
      <button className="cancel-btn" onClick={onCancel} disabled={cancelling}>
        {cancelling ? "Stopping…" : "Cancel scan"}
      </button>
    </div>
  );
}
