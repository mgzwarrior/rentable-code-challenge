import React, { useEffect, useState } from 'react';
import NotInPmsBadge from './NotInPmsBadge';

function TenantList({ onViewLedger }) {
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

    return (
        <div className="tenant-list">
            <h2>Tenants</h2>
            {tenants.length === 0 ? (
                <p>No tenants found.</p>
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
                        {tenants.map(tenant => (
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
        </div>
    );
}

export default TenantList; 