import React, { useEffect, useState } from 'react';
import NotInPmsBadge, { NOT_IN_PMS_LABEL } from './NotInPmsBadge';
import { formatMoney, toCents } from './money';

const SORTABLE_COLUMNS = [
    { key: 'pms_tenant_id', label: 'PMS ID' },
    { key: 'name', label: 'Name' },
    { key: 'unit', label: 'Unit' },
    { key: 'balance', label: 'Balance', className: 'tenant-balance', firstDirection: 'desc' },
];

function compareTenants(a, b, column) {
    if (column === 'balance') {
        return toCents(a.balance) - toCents(b.balance);
    }
    if (column === 'pms_tenant_id') {
        return a.pms_tenant_id - b.pms_tenant_id;
    }
    return String(a[column] ?? '').localeCompare(String(b[column] ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function sortTenants(tenants, sort) {
    if (!sort.column) {
        return tenants;
    }
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...tenants].sort((a, b) => {
        if (sort.column === 'pms_tenant_id' && (a.pms_tenant_id === null || b.pms_tenant_id === null)) {
            return (a.pms_tenant_id === null) - (b.pms_tenant_id === null);
        }
        return direction * compareTenants(a, b, sort.column);
    });
}

function nextSort(sort, column) {
    if (sort.column !== column.key) {
        return { column: column.key, direction: column.firstDirection ?? 'asc' };
    }
    return { column: column.key, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
}

function ariaSort(sort, column) {
    if (sort.column !== column.key) {
        return 'none';
    }
    return sort.direction === 'asc' ? 'ascending' : 'descending';
}

function matchesSearch(tenant, query) {
    return [tenant.name, tenant.unit ?? '', tenant.pms_tenant_id ?? NOT_IN_PMS_LABEL]
        .some(value => String(value).toLowerCase().includes(query));
}

function summarize(tenants) {
    const summary = { owedCents: 0, owing: 0, creditCents: 0, inCredit: 0, settled: 0, notInPms: 0 };
    tenants.forEach(tenant => {
        const cents = toCents(tenant.balance);
        if (tenant.pms_tenant_id === null) {
            summary.notInPms += 1;
        } else if (cents > 0) {
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

function balanceCell(tenant) {
    if (tenant.pms_tenant_id === null) {
        return <td className="tenant-balance tenant-balance-settled">No ledger</td>;
    }
    const cents = toCents(tenant.balance);
    if (cents > 0) {
        return <td className="tenant-balance">{formatMoney(tenant.balance)}</td>;
    }
    if (cents < 0) {
        return <td className="tenant-balance tenant-balance-credit">{formatMoney(-cents / 100)} credit</td>;
    }
    return <td className="tenant-balance tenant-balance-settled">Settled</td>;
}

function TenantList({ onViewLedger, search, onSearchChange, sort, onSortChange }) {
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
    const visibleTenants = sortTenants(tenants.filter(tenant => matchesSearch(tenant, query)), sort);
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
                        {summary.notInPms > 0 && ` · ${summary.notInPms} not in PMS`}
                    </p>
                    {visibleTenants.length === 0 ? (
                        <p>No tenants match "{search.trim()}".</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    {SORTABLE_COLUMNS.map(column => (
                                        <th key={column.key} className={column.className} aria-sort={ariaSort(sort, column)}>
                                            <button className="sort-button" onClick={() => onSortChange(nextSort(sort, column))}>
                                                {column.label}
                                                {sort.column === column.key && (sort.direction === 'asc' ? ' ▲' : ' ▼')}
                                            </button>
                                        </th>
                                    ))}
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTenants.map(tenant => (
                                    <tr key={tenant.id}>
                                        <td>{tenant.pms_tenant_id ?? <NotInPmsBadge />}</td>
                                        <td>{tenant.name}</td>
                                        <td>{tenant.unit}</td>
                                        {balanceCell(tenant)}
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