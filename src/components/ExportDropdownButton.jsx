import React, { useState, useRef, useEffect, useCallback } from "react";
import { useGoogleIdentityServices } from "../hooks/useGoogleIdentityServices";
import "./ExportDropdownButton.css";

export default function ExportDropdownButton({
  label,
  icon,
  onDocx,
  onDrive,
  disabled,
  driveAvailable,
  storageKey,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastDest, setLastDest] = useState(
    () => localStorage.getItem(storageKey) || "docx"
  );
  const gisReady = useGoogleIdentityServices();

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);

  const destLabel = lastDest === "drive" ? "Google Drive" : "Word (.docx)";
  const driveEnabled = driveAvailable && gisReady;

  const handleSelect = useCallback(
    async (dest) => {
      setOpen(false);
      setLastDest(dest);
      localStorage.setItem(storageKey, dest);
      setLoading(true);
      try {
        await (dest === "drive" ? onDrive() : onDocx());
      } finally {
        setLoading(false);
      }
    },
    [storageKey, onDocx, onDrive]
  );

  const handlePrimaryClick = useCallback(() => {
    handleSelect(lastDest);
  }, [handleSelect, lastDest]);

  function handleMenuKeyDown(e) {
    const items = itemRefs.current.filter(Boolean);
    const idx = items.indexOf(document.activeElement);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const driveTitle = !driveAvailable
    ? "Set REACT_APP_GOOGLE_CLIENT_ID to enable Google Drive export"
    : !gisReady
    ? "Google Identity Services loading…"
    : undefined;

  return (
    <div role="group" aria-label={label} className="export-split-btn" ref={menuRef}>
      <button
        className="export-split-btn__primary preview-btn"
        onClick={handlePrimaryClick}
        disabled={disabled || loading}
        title={lastDest === "drive" ? driveTitle : undefined}
      >
        {loading ? "Exporting…" : `${icon} ${label} → ${destLabel}`}
      </button>

      <button
        ref={triggerRef}
        className="export-split-btn__chevron preview-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Choose ${label} destination`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || loading}
      >
        ▾
      </button>

      {open && (
        <ul role="menu" className="export-split-btn__menu" onKeyDown={handleMenuKeyDown}>
          <li role="none">
            <button
              role="menuitem"
              ref={(el) => (itemRefs.current[0] = el)}
              onClick={() => handleSelect("docx")}
              autoFocus
            >
              Word (.docx)
            </button>
          </li>
          <li role="none">
            <button
              role="menuitem"
              ref={(el) => (itemRefs.current[1] = el)}
              onClick={() => handleSelect("drive")}
              disabled={!driveEnabled}
              title={driveTitle}
            >
              Google Drive{!driveAvailable ? " (not configured)" : ""}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
