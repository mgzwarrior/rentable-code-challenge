import { render, screen, within } from '@testing-library/react';
import TenantLedger from './TenantLedger';

const tenant = { id: 4, name: 'Daisy Ridley', unit: 'C303', pms_tenant_id: 3 };

function ledgerResponse(overrides) {
    return {
        tenant,
        total_charges: '1220.00',
        total_payments: '800.00',
        balance: '420.00',
        transactions: [
            { id: 1, date: '2023-01-01', type: 'charge', description: 'Rent Charge - January', amount: '1300.00', running_balance: '1300.00' },
            { id: 2, date: '2023-01-03', type: 'payment', description: 'Rent Payment - January', amount: '800.00', running_balance: '500.00' },
            { id: 3, date: '2023-03-05', type: 'charge', description: 'Utility Credit', amount: '-80.00', running_balance: '420.00' },
        ],
        ...overrides,
    };
}

function mockFetch(body, ok = true, status = 200) {
    global.fetch = jest.fn(() => Promise.resolve({ ok, status, json: () => Promise.resolve(body) }));
}

function summaryValue(label) {
    return within(screen.getByText(label).parentElement).getByText(/\$/).textContent;
}

test('requests the ledger for the given tenant', async () => {
    mockFetch(ledgerResponse());

    render(<TenantLedger tenant={tenant} onBack={() => {}} />);

    await screen.findByText('Total charges');
    expect(global.fetch).toHaveBeenCalledWith('/api/tenants/4/ledger/');
});

test('shows the tenant, totals and balance', async () => {
    mockFetch(ledgerResponse());

    render(<TenantLedger tenant={tenant} onBack={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Daisy Ridley' })).toBeInTheDocument();
    expect(screen.getByText(/Unit C303 · PMS ID 3/)).toBeInTheDocument();
    await screen.findByText('Total charges');
    expect(summaryValue('Total charges')).toBe('$1,220.00');
    expect(summaryValue('Total payments')).toBe('$800.00');
    expect(summaryValue('Balance owed')).toBe('$420.00');
});

test('lists transactions with charge, payment and running balance columns', async () => {
    mockFetch(ledgerResponse());

    render(<TenantLedger tenant={tenant} onBack={() => {}} />);

    const rows = (await screen.findAllByRole('row')).slice(1);
    const cells = rows.map(row => within(row).getAllByRole('cell').map(cell => cell.textContent));
    expect(cells).toEqual([
        ['2023-01-01', 'Rent Charge - January', '$1,300.00', '', '$1,300.00'],
        ['2023-01-03', 'Rent Payment - January', '', '$800.00', '$500.00'],
        ['2023-03-05', 'Utility Credit', '-$80.00', '', '$420.00'],
    ]);
});

test('labels a negative balance as a credit', async () => {
    mockFetch(ledgerResponse({ balance: '-50.00' }));

    render(<TenantLedger tenant={tenant} onBack={() => {}} />);

    await screen.findByText('Credit');
    expect(summaryValue('Credit')).toBe('$50.00');
});

test('labels a zero balance as settled', async () => {
    mockFetch(ledgerResponse({ balance: '0.00' }));

    render(<TenantLedger tenant={tenant} onBack={() => {}} />);

    await screen.findByText('Settled');
    expect(summaryValue('Settled')).toBe('$0.00');
});

test('shows a message when the tenant has no transactions', async () => {
    mockFetch(ledgerResponse({ total_charges: '0.00', total_payments: '0.00', balance: '0.00', transactions: [] }));

    render(<TenantLedger tenant={{ id: 3, name: 'Charlie Chaplin', unit: 'C303', pms_tenant_id: null }} onBack={() => {}} />);

    expect(await screen.findByText('No transactions for this tenant.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Not in PMS')).toBeInTheDocument();
    expect(screen.queryByText(/PMS ID/)).not.toBeInTheDocument();
});

test('shows an error when the ledger cannot be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({}, false, 500);

    render(<TenantLedger tenant={tenant} onBack={() => {}} />);

    expect(await screen.findByText('Error loading ledger: HTTP error! status: 500')).toBeInTheDocument();
});
