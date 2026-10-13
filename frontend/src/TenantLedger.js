import React, { useEffect, useState } from 'react';
import NotInPmsBadge from './NotInPmsBadge';
import { formatMoney } from './money';
import { saveBlob } from './download';

function balanceSummary(tenant, balance) {
    if (tenant.pms_tenant_id === null) {
        return { label: 'No ledger', className: 'ledger-balance-settled' };
    }
    const value = Number(balance);
    if (value > 0) {
        return { label: 'Balance owed', className: 'ledger-balance-owed' };
    }
    if (value < 0) {
        return { label: 'Credit', className: 'ledger-balance-credit' };
    }
    return { label: 'Settled', className: 'ledger-balance-settled' };
}

function amountCell(transaction, type, className) {
    if (transaction.type !== type) {
        return <td className="ledger-amount"></td>;
    }
    const negative = Number(transaction.amount) < 0;
    return (
        <td className={`ledger-amount ${negative ? 'ledger-negative' : className}`}>
            {formatMoney(transaction.amount)}
        </td>
    );
}

function TenantLedger({ tenant, onBack }) {
    const [ledger, setLedger] = useState(null);
    const [error, setError] = useState(null);
    const [exportError, setExportError] = useState(null);

    useEffect(() => {
        fetch(`/api/tenants/${tenant.id}/ledger/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => setLedger(data))
            .catch(error => {
                console.error("Error fetching ledger:", error);
                setError(error);
            });
    }, [tenant.id]);

    function exportCsv() {
        setExportError(null);
        fetch(`/api/tenants/${tenant.id}/ledger/export/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const disposition = response.headers.get('Content-Disposition') || '';
                const filename = (disposition.match(/filename="([^"]+)"/) || [])[1] || 'ledger.csv';
                return response.blob().then(blob => saveBlob(blob, filename));
            })
            .catch(error => {
                console.error("Error exporting ledger:", error);
                setExportError(error);
            });
    }

    const balance = ledger && balanceSummary(tenant, ledger.balance);

    return (
        <div className="tenant-ledger">
            <div className="ledger-actions">
                <button onClick={onBack}>Back to tenants</button>
                <button onClick={exportCsv} disabled={!ledger}>Export CSV</button>
            </div>
            {exportError && <div>Error exporting ledger: {exportError.message}</div>}
            <h2>{tenant.name}</h2>
            <p className="tenant-ledger-meta">
                Unit {tenant.unit} · {tenant.pms_tenant_id === null ? <NotInPmsBadge /> : `PMS ID ${tenant.pms_tenant_id}`}
            </p>
            {error ? (
                <div>Error loading ledger: {error.message}</div>
            ) : !ledger ? (
                <p>Loading ledger...</p>
            ) : (
                <>
                    <div className="ledger-summary">
                        <div className="ledger-summary-item">
                            <div className="ledger-summary-label">Total charges</div>
                            <div className="ledger-summary-value">{formatMoney(ledger.total_charges)}</div>
                        </div>
                        <div className="ledger-summary-item">
                            <div className="ledger-summary-label">Total payments</div>
                            <div className="ledger-summary-value">{formatMoney(ledger.total_payments)}</div>
                        </div>
                        <div className={`ledger-summary-item ${balance.className}`}>
                            <div className="ledger-summary-label">{balance.label}</div>
                            <div className="ledger-summary-value">{formatMoney(Math.abs(Number(ledger.balance)))}</div>
                        </div>
                    </div>
                    {ledger.transactions.length === 0 ? (
                        <p>No transactions for this tenant.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Transaction ID</th>
                                    <th>Description</th>
                                    <th className="ledger-amount">Charge</th>
                                    <th className="ledger-amount">Payment</th>
                                    <th className="ledger-amount">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.transactions.map(transaction => (
                                    <tr key={transaction.id}>
                                        <td>{transaction.date}</td>
                                        <td>{transaction.pms_transaction_id}</td>
                                        <td>{transaction.description}</td>
                                        {amountCell(transaction, 'charge', 'ledger-charge')}
                                        {amountCell(transaction, 'payment', 'ledger-payment')}
                                        <td className="ledger-amount">{formatMoney(transaction.running_balance)}</td>
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

export default TenantLedger;
