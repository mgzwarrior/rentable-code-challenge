import React from 'react';

export const NOT_IN_PMS_LABEL = 'Not in PMS';

function NotInPmsBadge() {
    return (
        <span className="badge-not-in-pms" title="No matching tenant in the PMS, so no ledger is imported.">
            {NOT_IN_PMS_LABEL}
        </span>
    );
}

export default NotInPmsBadge;
