import React, { useState } from "react";

/**
 * A list that mounts only its first `cap` items, with a quiet toggle to
 * reveal the rest and cap it again. Keeping the expanded flag inside the
 * helper means every list caps itself independently — each category
 * block, the duplicate panel and each set's path list get their own —
 * and a fresh scan starts capped again because the sections remount.
 * Short lists render exactly as before: same markup, no button.
 */
export default function CappedList({ tag: Tag = "ul", className, items, cap, renderItem }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, cap);
  const hidden = items.length - cap;
  return (
    <>
      <Tag className={className}>{visible.map(renderItem)}</Tag>
      {hidden > 0 && (
        <button className="list-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      )}
    </>
  );
}
