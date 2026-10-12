import React, { useEffect, useState } from 'react';
import NotInPmsBadge, { NOT_IN_PMS_LABEL } from './NotInPmsBadge';

function matchesSearch(tenant, query) {
    return [tenant.name, tenant.unit ?? '', tenant.pms_tenant_id ?? NOT_IN_PMS_LABEL]
        .some(value => String(value).toLowerCase().includes(query));
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
                    {visibleTenants.length === 0 ? (
                        <p>No tenants match "{search.trim()}".</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>PMS ID</th>
                                    <th>Name</th>
                                    <th>Unit</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTenants.map(tenant => (
                                    <tr key={tenant.id}>
                                        <td>{tenant.pms_tenant_id ?? <NotInPmsBadge />}</td>
                                        <td>{tenant.name}</td>
                                        <td>{tenant.unit}</td>
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