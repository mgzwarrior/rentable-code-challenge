import React from 'react';

function NotInPmsBadge() {
    return (
        <span className="badge-not-in-pms" title="No matching tenant in the PMS, so no ledger is imported.">
            Not in PMS
        </span>
    );
}

export default NotInPmsBadge;
