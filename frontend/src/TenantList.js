import React, { useEffect, useState } from 'react';
import NotInPmsBadge, { NOT_IN_PMS_LABEL } from './NotInPmsBadge';
import { formatMoney, toCents } from './money';

function matchesSearch(tenant, query) {
    return [tenant.name, tenant.unit ?? '', tenant.pms_tenant_id ?? NOT_IN_PMS_LABEL]
        .some(value => String(value).toLowerCase().includes(query));
}

function summarize(tenants) {
    const summary = { owedCents: 0, owing: 0, creditCents: 0, inCredit: 0, settled: 0 };
    tenants.forEach(tenant => {
        const cents = toCents(tenant.balance);
        if (cents > 0) {
            summary.owedCents += cents;
            summary.owing += 1;
        } else if (cents < 0) {
            summary.creditCents -= cents;
            summary.inCredit += 1;
        } else {
            summary.settled += 1;
        }
    });
    return summary;
}

function balanceCell(balance) {
    const cents = toCents(balance);
    if (cents > 0) {
        return <td className="tenant-balance">{formatMoney(balance)}</td>;
    }
    if (cents < 0) {
        return <td className="tenant-balance tenant-balance-credit">{formatMoney(-cents / 100)} credit</td>;
    }
    return <td className="tenant-balance tenant-balance-settled">Settled</td>;
}

function TenantList({ onViewLedger, search, onSearchChange }) {
    const [tenants, setTenants] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('/api/tenants/')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => setTenants(data))
            .catch(error => {
                console.error("Error fetching tenants:", error);
                setError(error);
            });
    }, []);

    if (error) {
        return <div>Error loading tenants: {error.message}</div>;
    }

    const query = search.trim().toLowerCase();
    const visibleTenants = tenants.filter(tenant => matchesSearch(tenant, query));
    const summary = summarize(visibleTenants);

    return (
        <div className="tenant-list">
            <h2>Tenants</h2>
            {tenants.length === 0 ? (
                <p>No tenants found.</p>
            ) : (
                <>
                    <div className="tenant-search">
                        <input
                            type="search"
                            aria-label="Search tenants"
                            placeholder="Search by name, unit or PMS ID"
                            value={search}
                            onChange={event => onSearchChange(event.target.value)}
                        />
                        <span>Showing {visibleTenants.length} of {tenants.length} tenants</span>
                    </div>
                    <p className="tenant-summary">
                        Outstanding <strong>{formatMoney(summary.owedCents / 100)}</strong>
                        {' · '}{summary.owing} owing
                        {' · '}{summary.inCredit} in credit ({formatMoney(summary.creditCents / 100)})
                        {' · '}{summary.settled} settled
                    </p>
                    {visibleTenants.length === 0 ? (
                        <p>No tenants match "{search.trim()}".</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>PMS ID</th>
                                    <th>Name</th>
                                    <th>Unit</th>
                                    <th className="tenant-balance">Balance</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTenants.map(tenant => (
                                    <tr key={tenant.id}>
                                        <td>{tenant.pms_tenant_id ?? <NotInPmsBadge />}</td>
                                        <td>{tenant.name}</td>
                                        <td>{tenant.unit}</td>
                                        {balanceCell(tenant.balance)}
                                        <td><button onClick={() => onViewLedger(tenant)}>View Ledger</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </div>
    );
}

export default TenantList; 